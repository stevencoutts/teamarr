"""Cross-group consolidation enforcement.

When multiple groups have channels for the same event, consolidates
streams into one channel based on group priority.

Use case:
- Multi-league group (ESPN+) matches an NHL game
- Single-league group (NHL) also has that game
- Move ESPN+ streams to NHL channel, delete ESPN+ channel

Respects overlap_handling per group:
- create_all: Keep separate channels, no consolidation
- skip: Delete channel but don't move streams
- add_stream/add_only: Move streams then delete (default)
"""

import logging
import threading
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class CrossGroupResult:
    """Result of cross-group consolidation."""

    streams_moved: list[dict] = field(default_factory=list)
    channels_deleted: list[dict] = field(default_factory=list)
    channels_skipped: list[dict] = field(default_factory=list)
    errors: list[dict] = field(default_factory=list)

    @property
    def moved_count(self) -> int:
        return len(self.streams_moved)

    @property
    def deleted_count(self) -> int:
        return len(self.channels_deleted)

    def to_dict(self) -> dict:
        return {
            "streams_moved": self.streams_moved,
            "channels_deleted": self.channels_deleted,
            "channels_skipped": self.channels_skipped,
            "errors": self.errors,
            "summary": {
                "moved": self.moved_count,
                "deleted": self.deleted_count,
                "skipped": len(self.channels_skipped),
                "errors": len(self.errors),
            },
        }


class CrossGroupEnforcer:
    """Enforces cross-group stream consolidation.

    Identifies when multiple groups have channels for the same event
    and consolidates them based on group sort_order priority:
    - Lower sort_order wins (user-configurable)
    - Earlier-created channels break ties

    The lower-priority channel's streams are moved to the higher-priority
    channel, and the lower-priority channel is deleted.
    """

    def __init__(
        self,
        db_factory: Any,
        channel_manager: Any = None,
    ):
        """Initialize the enforcer.

        Args:
            db_factory: Factory returning database connection
            channel_manager: Optional ChannelManager for Dispatcharr sync
        """
        self._db_factory = db_factory
        self._channel_manager = channel_manager
        self._dispatcharr_lock = threading.Lock()

    def enforce(self, group_ids: list[int] | None = None) -> CrossGroupResult:
        """Run cross-group consolidation.

        Finds duplicate channels across groups and consolidates them.
        Priority is determined by group sort_order (lower wins).

        Args:
            group_ids: Optional list of group IDs to check.
                If None, checks all enabled groups.

        Returns:
            CrossGroupResult with consolidation details
        """
        from teamarr.database.channels import (
            add_stream_to_channel,
            find_any_channel_for_event,
            get_channel_streams,
            get_managed_channels_for_group,
            get_next_stream_priority,
            log_channel_history,
            mark_channel_deleted,
            stream_exists_on_channel,
        )
        from teamarr.database.groups import get_all_groups

        result = CrossGroupResult()

        try:
            with self._db_factory() as conn:
                all_groups = get_all_groups(conn, include_disabled=False)

                # Build sort_order lookup for priority (lower = higher priority)
                group_sort_order = {
                    g.id: g.sort_order for g in all_groups
                }
                group_map = {g.id: g for g in all_groups}

                # Determine which groups to check
                check_groups = group_map
                if group_ids is not None:
                    check_groups = {
                        gid: g
                        for gid, g in group_map.items()
                        if gid in set(group_ids)
                    }

                if not check_groups:
                    logger.debug("[CROSS_GROUP] No groups to check")
                    return result

                for group_id, group in check_groups.items():
                    overlap_handling = getattr(
                        group, "overlap_handling", "add_stream"
                    )

                    if overlap_handling == "create_all":
                        continue

                    channels = get_managed_channels_for_group(
                        conn, group_id, include_deleted=False
                    )

                    for channel in channels:
                        event_id = channel.event_id
                        event_provider = channel.event_provider

                        if not event_id:
                            continue

                        target_channel = find_any_channel_for_event(
                            conn=conn,
                            event_id=event_id,
                            event_provider=event_provider,
                            exclude_group_id=group_id,
                        )

                        if not target_channel:
                            continue

                        # Use sort_order for priority (lower wins)
                        target_order = group_sort_order.get(
                            target_channel.event_epg_group_id, 999
                        )
                        our_order = group_sort_order.get(group_id, 999)

                        if our_order <= target_order:
                            # We have higher or equal priority, skip
                            result.channels_skipped.append(
                                {
                                    "channel": channel.channel_name,
                                    "reason": "Higher priority (lower sort_order)",
                                }
                            )
                            continue

                        streams = get_channel_streams(
                            conn, channel.id, include_removed=False
                        )
                        moved_count = 0

                        if overlap_handling in ("add_stream", "add_only"):
                            for stream in streams:
                                if stream_exists_on_channel(
                                    conn,
                                    target_channel.id,
                                    stream.dispatcharr_stream_id,
                                ):
                                    continue

                                priority = get_next_stream_priority(
                                    conn, target_channel.id
                                )
                                add_stream_to_channel(
                                    conn=conn,
                                    managed_channel_id=target_channel.id,
                                    dispatcharr_stream_id=stream.dispatcharr_stream_id,
                                    stream_name=stream.stream_name,
                                    priority=priority,
                                    source_group_id=group_id,
                                    source_group_type="cross_group",
                                    exception_keyword=stream.exception_keyword,
                                    m3u_account_name=stream.m3u_account_name,
                                )
                                moved_count += 1

                                result.streams_moved.append(
                                    {
                                        "stream": stream.stream_name,
                                        "from_channel": channel.channel_name,
                                        "to_channel": target_channel.channel_name,
                                    }
                                )

                            if self._channel_manager and moved_count > 0:
                                self._sync_streams_to_dispatcharr(
                                    from_channel_id=channel.dispatcharr_channel_id,
                                    to_channel_id=target_channel.dispatcharr_channel_id,
                                    streams=streams,
                                )

                        if (
                            self._channel_manager
                            and channel.dispatcharr_channel_id
                        ):
                            self._delete_channel_in_dispatcharr(
                                channel.dispatcharr_channel_id
                            )

                        action = (
                            "Skipped (deleted)"
                            if overlap_handling == "skip"
                            else "Consolidated into"
                        )
                        mark_channel_deleted(
                            conn, channel.id,
                            reason="Cross-group consolidation",
                        )

                        log_channel_history(
                            conn=conn,
                            managed_channel_id=channel.id,
                            change_type="deleted",
                            change_source="cross_group_enforcement",
                            notes=f"{action} '{target_channel.channel_name}'",
                        )

                        if moved_count > 0:
                            log_channel_history(
                                conn=conn,
                                managed_channel_id=target_channel.id,
                                change_type="stream_added",
                                change_source="cross_group_enforcement",
                                notes=(
                                    f"Received {moved_count} streams"
                                    " from cross-group"
                                ),
                            )

                        result.channels_deleted.append(
                            {
                                "channel": channel.channel_name,
                                "event_id": event_id,
                                "streams_moved": moved_count,
                                "consolidated_into": target_channel.channel_name,
                                "overlap_handling": overlap_handling,
                            }
                        )

                        logger.info(
                            "[CROSS_GROUP] %s #%s -> #%s (event=%s mode=%s)",
                            "Deleted"
                            if overlap_handling == "skip"
                            else "Consolidated",
                            channel.channel_number,
                            target_channel.channel_number,
                            event_id,
                            overlap_handling,
                        )

                conn.commit()

        except Exception as e:
            logger.exception("[CROSS_GROUP_ERROR] %s", e)
            result.errors.append({"error": str(e)})

        if result.deleted_count > 0:
            logger.info(
                "[CROSS_GROUP] Deleted %d channels, moved %d streams",
                result.deleted_count,
                result.moved_count,
            )

        return result

    def _sync_streams_to_dispatcharr(
        self,
        from_channel_id: int | None,
        to_channel_id: int | None,
        streams: list,
    ) -> None:
        """Move streams between channels in Dispatcharr.

        Args:
            from_channel_id: Source channel
            to_channel_id: Target channel
            streams: List of stream records to move
        """
        if not self._channel_manager or not to_channel_id:
            return

        try:
            with self._dispatcharr_lock:
                channel = self._channel_manager.get_channel(to_channel_id)
                if not channel:
                    return

                # channel.streams is already a tuple of stream IDs
                current_streams = list(channel.streams) if channel.streams else []
                stream_ids = [s.dispatcharr_stream_id for s in streams]

                new_streams = current_streams + [
                    sid for sid in stream_ids if sid not in current_streams
                ]

                if new_streams != current_streams:
                    logger.info(
                        "[STREAM_AUDIT] cross_group: ch %s streams %s → %s",
                        to_channel_id,
                        current_streams,
                        new_streams,
                    )
                    self._channel_manager.update_channel(to_channel_id, {"streams": new_streams})

        except Exception as e:
            logger.warning("[CROSS_GROUP] Failed to sync streams to Dispatcharr: %s", e)

    def _delete_channel_in_dispatcharr(self, channel_id: int) -> None:
        """Delete channel in Dispatcharr.

        Args:
            channel_id: Dispatcharr channel ID
        """
        if not self._channel_manager:
            return

        try:
            with self._dispatcharr_lock:
                self._channel_manager.delete_channel(channel_id)
        except Exception as e:
            logger.warning("[CROSS_GROUP] Failed to delete channel in Dispatcharr: %s", e)
