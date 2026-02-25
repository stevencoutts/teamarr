import React, { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useQuery } from "@tanstack/react-query"
import {
  Search,
  Trash2,
  Pencil,
  Loader2,
  Download,
  X,
  Check,
  AlertCircle,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  RotateCcw,
  Library,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { FilterSelect } from "@/components/ui/filter-select"
import { Select } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
  useBulkUpdateGroups,
  useClearGroupMatchCache,
  useClearGroupsMatchCache,
  useGroups,
  useDeleteGroup,
  useToggleGroup,
  usePreviewGroup,
  useReorderGroups,
} from "@/hooks/useGroups"
import type { EventGroup, PreviewGroupResponse } from "@/api/types"
import { getLeagues } from "@/api/teams"
import { ChannelProfileSelector } from "@/components/ChannelProfileSelector"
import { StreamProfileSelector } from "@/components/StreamProfileSelector"
import { StreamTimezoneSelector } from "@/components/StreamTimezoneSelector"
import { SubscribedSports } from "@/components/SubscribedSports"
import { getLeagueDisplayName } from "@/lib/utils"

// Fetch Dispatcharr channel groups for name lookup
async function fetchChannelGroups(): Promise<{ id: number; name: string }[]> {
  const response = await fetch("/api/v1/groups/dispatcharr/channel-groups")
  if (!response.ok) return []
  const data = await response.json()
  return data.groups || []
}

// Helper to get display name (prefer display_name over name)
const getDisplayName = (group: EventGroup) => group.display_name || group.name

export function EventGroups() {
  const navigate = useNavigate()
  const { data, isLoading, error, refetch } = useGroups(true)
  const { data: leaguesResponse } = useQuery({ queryKey: ["leagues"], queryFn: () => getLeagues() })
  const cachedLeagues = leaguesResponse?.leagues
  const { data: channelGroups } = useQuery({ queryKey: ["dispatcharr-channel-groups"], queryFn: fetchChannelGroups })
  const deleteMutation = useDeleteGroup()
  const toggleMutation = useToggleGroup()
  const bulkUpdateMutation = useBulkUpdateGroups()
  const previewMutation = usePreviewGroup()
  const reorderMutation = useReorderGroups()
  const clearCacheMutation = useClearGroupMatchCache()
  const clearCachesBulkMutation = useClearGroupsMatchCache()

  // Drag-and-drop state for AUTO groups
  const [draggedGroupId, setDraggedGroupId] = useState<number | null>(null)

  // Preview modal state
  const [previewData, setPreviewData] = useState<PreviewGroupResponse | null>(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)

  // Clear cache confirmation state
  const [clearCacheConfirm, setClearCacheConfirm] = useState<EventGroup | null>(null)
  const [showBulkClearCache, setShowBulkClearCache] = useState(false)

  // Create channel group ID to name lookup
  const channelGroupNames = useMemo(() => {
    const names: Record<number, string> = {}
    if (channelGroups) {
      for (const group of channelGroups) {
        names[group.id] = group.name
      }
    }
    return names
  }, [channelGroups])

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // Filter state
  const [nameFilter, setNameFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<"" | "enabled" | "disabled">("")

  const [deleteConfirm, setDeleteConfirm] = useState<EventGroup | null>(null)
  const [showBulkDelete, setShowBulkDelete] = useState(false)
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  // Bulk edit form state - checkboxes control which fields to update
  const [bulkEditChannelGroupEnabled, setBulkEditChannelGroupEnabled] = useState(false)
  const [bulkEditChannelGroupId, setBulkEditChannelGroupId] = useState<number | null>(null)
  const [bulkEditChannelGroupMode, setBulkEditChannelGroupMode] = useState<'static' | 'sport' | 'league'>('static')
  const [bulkEditClearChannelGroup, setBulkEditClearChannelGroup] = useState(false)
  const [bulkEditProfilesEnabled, setBulkEditProfilesEnabled] = useState(false)
  const [bulkEditProfileIds, setBulkEditProfileIds] = useState<(number | string)[]>([])
  const [bulkEditUseDefaultProfiles, setBulkEditUseDefaultProfiles] = useState(true)
  const [bulkEditStreamProfileEnabled, setBulkEditStreamProfileEnabled] = useState(false)
  const [bulkEditStreamProfileId, setBulkEditStreamProfileId] = useState<number | null>(null)
  const [bulkEditUseDefaultStreamProfile, setBulkEditUseDefaultStreamProfile] = useState(true)
  const [bulkEditStreamTimezoneEnabled, setBulkEditStreamTimezoneEnabled] = useState(false)
  const [bulkEditStreamTimezone, setBulkEditStreamTimezone] = useState<string | null>(null)
  const [bulkEditClearStreamTimezone, setBulkEditClearStreamTimezone] = useState(false)
  // Column sorting state
  type SortColumn = "name" | "matched" | "status" | null
  type SortDirection = "asc" | "desc"
  const [sortColumn, setSortColumn] = useState<SortColumn>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  // Handle column sort
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  // Sort icon component
  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3 w-3 ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1" />
    )
  }

  // Filter and sort groups by priority
  const { autoGroups, filteredGroups } = useMemo(() => {
    if (!data?.groups) return { autoGroups: [], filteredGroups: [] }

    // Filter groups
    const filtered = data.groups.filter((group) => {
      if (nameFilter && !group.name.toLowerCase().includes(nameFilter.toLowerCase())) return false
      if (statusFilter === "enabled" && !group.enabled) return false
      if (statusFilter === "disabled" && group.enabled) return false
      return true
    })

    // Sort all groups by sort_order (drag-and-drop priority)
    const sorted = filtered
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

    return {
      autoGroups: sorted,
      filteredGroups: sorted,
    }
  }, [data?.groups, nameFilter, statusFilter])

  // Apply column sorting when a column header is clicked
  const sortedGroups = useMemo(() => {
    if (!sortColumn) return filteredGroups

    const sortFn = (a: EventGroup, b: EventGroup) => {
      let cmp = 0
      switch (sortColumn) {
        case "name":
          cmp = getDisplayName(a).localeCompare(getDisplayName(b))
          break
        case "matched":
          cmp = (a.matched_count || 0) - (b.matched_count || 0)
          break
        case "status":
          cmp = (a.enabled ? 1 : 0) - (b.enabled ? 1 : 0)
          break
      }
      return sortDirection === "asc" ? cmp : -cmp
    }

    return [...filteredGroups].sort(sortFn)
  }, [filteredGroups, sortColumn, sortDirection])

  // Calculate rich stats like V1
  const stats = useMemo(() => {
    if (!data?.groups) return {
      totalStreams: 0,
      totalFiltered: 0,
      filteredIncludeRegex: 0,
      filteredExcludeRegex: 0,
      filteredNotEvent: 0,
      failedCount: 0,
      streamsExcluded: 0,
      excludedEventFinal: 0,
      excludedEventPast: 0,
      excludedBeforeWindow: 0,
      excludedLeagueNotIncluded: 0,
      matched: 0,
      matchRate: 0,
      // Per-group breakdowns for tooltips
      streamsByGroup: [] as { name: string; count: number }[],
    }

    // Sum all groups (parents + children) - each has distinct streams from different M3U accounts
    const groups = data.groups
    const totalStreams = groups.reduce((sum, g) => sum + (g.total_stream_count || 0), 0)
    const filteredIncludeRegex = groups.reduce((sum, g) => sum + (g.filtered_include_regex || 0), 0)
    const filteredExcludeRegex = groups.reduce((sum, g) => sum + (g.filtered_exclude_regex || 0), 0)
    const filteredNotEvent = groups.reduce((sum, g) => sum + (g.filtered_not_event || 0), 0)
    const filteredTeam = groups.reduce((sum, g) => sum + (g.filtered_team || 0), 0)
    const streamsExcluded = groups.reduce((sum, g) => sum + (g.streams_excluded || 0), 0)
    const excludedEventFinal = groups.reduce((sum, g) => sum + (g.excluded_event_final || 0), 0)
    const excludedEventPast = groups.reduce((sum, g) => sum + (g.excluded_event_past || 0), 0)
    const excludedBeforeWindow = groups.reduce((sum, g) => sum + (g.excluded_before_window || 0), 0)
    const excludedLeagueNotIncluded = groups.reduce((sum, g) => sum + (g.excluded_league_not_included || 0), 0)
    const totalFiltered = filteredIncludeRegex + filteredExcludeRegex + filteredNotEvent + filteredTeam
    const matched = groups.reduce((sum, g) => sum + (g.matched_count || 0), 0)
    const failedCount = groups.reduce((sum, g) => sum + (g.failed_count || 0), 0)
    // Match rate = matched / (matched + failed) - percentage of match attempts that succeeded
    const totalAttempted = matched + failedCount
    const matchRate = totalAttempted > 0 ? Math.round((matched / totalAttempted) * 100) : 0

    // Per-group breakdowns for tooltips (all groups, not just parents)
    const streamsByGroup = groups
      .filter(g => (g.total_stream_count || 0) > 0)
      .map(g => ({ name: getDisplayName(g), count: g.total_stream_count || 0 }))
      .sort((a, b) => b.count - a.count)

    return {
      totalStreams,
      totalFiltered,
      filteredIncludeRegex,
      filteredExcludeRegex,
      filteredNotEvent,
      filteredTeam,
      failedCount,
      streamsExcluded,
      excludedEventFinal,
      excludedEventPast,
      excludedBeforeWindow,
      excludedLeagueNotIncluded,
      matched,
      matchRate,
      streamsByGroup,
    }
  }, [data?.groups])

  // League slug -> display name lookup (uses {league} variable resolution: alias first, then name)
  const getLeagueDisplay = useMemo(() => {
    const map = new Map<string, string>()
    for (const league of cachedLeagues ?? []) {
      // {league} variable uses league_alias if available, otherwise name
      map.set(league.slug, getLeagueDisplayName(league, true))
    }
    return (slug: string | null | undefined) => {
      if (!slug) return "-"
      return map.get(slug) ?? slug.toUpperCase()
    }
  }, [cachedLeagues])

  const handleDelete = async () => {
    if (!deleteConfirm) return

    try {
      const result = await deleteMutation.mutateAsync(deleteConfirm.id)
      toast.success(result.message)
      setDeleteConfirm(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete group")
    }
  }

  const handleToggle = async (group: EventGroup) => {
    try {
      await toggleMutation.mutateAsync({
        groupId: group.id,
        enabled: !group.enabled,
      })
      toast.success(`${group.enabled ? "Disabled" : "Enabled"} group "${getDisplayName(group)}"`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle group")
    }
  }

  const handlePreview = async (group: EventGroup) => {
    try {
      const result = await previewMutation.mutateAsync(group.id)
      setPreviewData(result)
      setShowPreviewModal(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to preview group")
    }
  }

  const handleClearCache = async (group: EventGroup) => {
    try {
      const result = await clearCacheMutation.mutateAsync(group.id)
      toast.success(`Cleared ${result.entries_cleared} cache entries for "${getDisplayName(group)}"`)
      setClearCacheConfirm(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear cache")
    }
  }

  const handleBulkClearCache = async () => {
    try {
      const result = await clearCachesBulkMutation.mutateAsync(Array.from(selectedIds))
      toast.success(`Cleared ${result.total_cleared} cache entries across ${result.by_group?.length || 0} groups`)
      setShowBulkClearCache(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear cache")
    }
  }

  // Selection handlers
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedGroups.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sortedGroups.map((g) => g.id)))
    }
  }

  // Bulk actions
  const handleBulkToggle = async (enable: boolean) => {
    const groupsToToggle = sortedGroups.filter(
      (g) => selectedIds.has(g.id) && g.enabled !== enable
    )
    for (const group of groupsToToggle) {
      try {
        await toggleMutation.mutateAsync({ groupId: group.id, enabled: enable })
      } catch (err) {
        console.error(`Failed to toggle group ${group.name}:`, err)
      }
    }
    toast.success(`${enable ? "Enabled" : "Disabled"} ${groupsToToggle.length} groups`)
    setSelectedIds(new Set())
  }

  const handleBulkDelete = async () => {
    let deleted = 0
    for (const id of selectedIds) {
      try {
        await deleteMutation.mutateAsync(id)
        deleted++
      } catch (err) {
        console.error(`Failed to delete group ${id}:`, err)
      }
    }
    toast.success(`Deleted ${deleted} groups`)
    setSelectedIds(new Set())
    setShowBulkDelete(false)
  }

  // Check if selection has mixed group_modes (single vs multi)
  // Reset bulk edit form state
  const resetBulkEditForm = () => {
    setBulkEditChannelGroupEnabled(false)
    setBulkEditChannelGroupId(null)
    setBulkEditChannelGroupMode('static')
    setBulkEditClearChannelGroup(false)
    setBulkEditProfilesEnabled(false)
    setBulkEditProfileIds([])
    setBulkEditUseDefaultProfiles(true)
    setBulkEditStreamTimezoneEnabled(false)
    setBulkEditStreamTimezone(null)
    setBulkEditClearStreamTimezone(false)
  }

  const handleBulkEdit = async () => {
    const ids = Array.from(selectedIds)

    // Build request with only enabled fields
    const request: {
      group_ids: number[]
      channel_group_id?: number | null
      channel_group_mode?: 'static' | 'sport' | 'league'
      channel_profile_ids?: (number | string)[]
      stream_profile_id?: number | null
      stream_timezone?: string | null
      clear_channel_group_id?: boolean
      clear_channel_profile_ids?: boolean
      clear_stream_profile_id?: boolean
      clear_stream_timezone?: boolean
    } = { group_ids: ids }

    if (bulkEditChannelGroupEnabled) {
      if (bulkEditClearChannelGroup) {
        request.clear_channel_group_id = true
      } else {
        request.channel_group_mode = bulkEditChannelGroupMode
        if (bulkEditChannelGroupMode === 'static' && bulkEditChannelGroupId) {
          request.channel_group_id = bulkEditChannelGroupId
        }
      }
    }
    if (bulkEditProfilesEnabled) {
      if (bulkEditUseDefaultProfiles) {
        // Use default = clear and fall back to global setting (null)
        request.clear_channel_profile_ids = true
      } else {
        // Custom selection (could be empty [] for "no profiles" or specific ids)
        request.channel_profile_ids = bulkEditProfileIds
      }
    }
    if (bulkEditStreamProfileEnabled) {
      if (bulkEditUseDefaultStreamProfile) {
        // Use default = clear and fall back to global setting (null)
        request.clear_stream_profile_id = true
      } else {
        // Specific stream profile selected
        request.stream_profile_id = bulkEditStreamProfileId
      }
    }
    if (bulkEditStreamTimezoneEnabled) {
      if (bulkEditClearStreamTimezone) {
        // Reset to auto-detect from stream
        request.clear_stream_timezone = true
      } else if (bulkEditStreamTimezone) {
        // Specific timezone selected
        request.stream_timezone = bulkEditStreamTimezone
      }
    }
    try {
      const result = await bulkUpdateMutation.mutateAsync(request)
      if (result.total_failed > 0) {
        toast.warning(`Updated ${result.total_updated} groups, ${result.total_failed} failed`)
      } else {
        toast.success(`Updated ${result.total_updated} groups`)
      }
      setSelectedIds(new Set())
      setShowBulkEdit(false)
      resetBulkEditForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update groups")
    }
  }

  const clearFilters = () => {
    setNameFilter("")
    setStatusFilter("")
  }

  const hasActiveFilters = nameFilter || statusFilter !== ""

  // Drag-and-drop handlers for AUTO groups
  const handleDragStart = (e: React.DragEvent, groupId: number) => {
    setDraggedGroupId(groupId)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = async (e: React.DragEvent, targetGroupId: number) => {
    e.preventDefault()
    if (!draggedGroupId || draggedGroupId === targetGroupId) {
      setDraggedGroupId(null)
      return
    }

    // Find current positions
    const draggedIndex = autoGroups.findIndex((g) => g.id === draggedGroupId)
    const targetIndex = autoGroups.findIndex((g) => g.id === targetGroupId)

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedGroupId(null)
      return
    }

    // Build new order
    const newOrder = [...autoGroups]
    const [dragged] = newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, dragged)

    // Assign new sort_order values
    const reorderData = newOrder.map((g, i) => ({ group_id: g.id, sort_order: i }))

    try {
      await reorderMutation.mutateAsync(reorderData)
      toast.success("Group order updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reorder groups")
    }

    setDraggedGroupId(null)
  }

  const handleDragEnd = () => {
    setDraggedGroupId(null)
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Event Groups</h1>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">
              Error loading groups: {error.message}
            </p>
            <Button className="mt-4" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Header - Compact */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Event Groups</h1>
          <p className="text-sm text-muted-foreground">
            Configure event-based EPG from M3U stream groups
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/detection-library")}>
            <Library className="h-4 w-4 mr-1" />
            Detection Library
          </Button>
          <Button size="sm" onClick={() => navigate("/event-groups/import")}>
            <Download className="h-4 w-4 mr-1" />
            Import
          </Button>
        </div>
      </div>

      {/* Subscribed Sports — global league/soccer/template management */}
      <SubscribedSports />

      {/* Stats Tiles - V1 Style: Grid with 4 equal columns filling width */}
      {data?.groups && data.groups.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
            {/* Total Streams */}
            <div className="group relative">
              <div className="bg-secondary rounded px-3 py-2 cursor-help">
                <div className="text-xl font-bold">{stats.totalStreams}</div>
                <div className="text-[0.65rem] text-muted-foreground uppercase tracking-wider">Streams</div>
              </div>
              {stats.streamsByGroup.length > 0 && (
                <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover:block">
                  <Card className="p-3 shadow-lg border min-w-[200px]">
                    <div className="text-xs font-medium text-muted-foreground mb-2">By Event Group</div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {stats.streamsByGroup.slice(0, 10).map((g, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="truncate max-w-[140px]">{g.name}</span>
                          <span className="font-medium ml-2">{g.count}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}
            </div>

            {/* Filtered */}
            <div className="group relative">
              <div className="bg-secondary rounded px-3 py-2 cursor-help">
                <div className={`text-xl font-bold ${stats.totalFiltered > 0 ? 'text-amber-500' : ''}`}>{stats.totalFiltered}</div>
                <div className="text-[0.65rem] text-muted-foreground uppercase tracking-wider">Filtered</div>
              </div>
              {stats.totalFiltered > 0 && (
                <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover:block">
                  <Card className="p-3 shadow-lg border min-w-[200px]">
                    <div className="text-xs font-medium text-muted-foreground mb-2">Filter Breakdown</div>
                    <div className="space-y-1">
                      {stats.filteredNotEvent > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>Not Event Stream</span>
                          <span className="font-medium">{stats.filteredNotEvent}</span>
                        </div>
                      )}
                      {stats.filteredIncludeRegex > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>Include Regex not Matched</span>
                          <span className="font-medium">{stats.filteredIncludeRegex}</span>
                        </div>
                      )}
                      {stats.filteredExcludeRegex > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>Exclude Regex Matched</span>
                          <span className="font-medium">{stats.filteredExcludeRegex}</span>
                        </div>
                      )}
                      {(stats.filteredTeam ?? 0) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>Team Filter</span>
                          <span className="font-medium">{stats.filteredTeam}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-medium pt-1 border-t">
                        <span>Total</span>
                        <span>{stats.totalFiltered}</span>
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </div>

            {/* Excluded */}
            <div className="group relative">
              <div className="bg-secondary rounded px-3 py-2 cursor-help">
                <div className={`text-xl font-bold ${stats.streamsExcluded > 0 ? 'text-yellow-500' : ''}`}>{stats.streamsExcluded}</div>
                <div className="text-[0.65rem] text-muted-foreground uppercase tracking-wider">Excluded</div>
              </div>
              {stats.streamsExcluded > 0 && (
                <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover:block">
                  <Card className="p-3 shadow-lg border min-w-[200px]">
                    <div className="text-xs font-medium text-muted-foreground mb-2">Exclusion Breakdown</div>
                    <div className="space-y-1">
                      {stats.excludedLeagueNotIncluded > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>League Not Enabled</span>
                          <span className="font-medium">{stats.excludedLeagueNotIncluded}</span>
                        </div>
                      )}
                      {stats.excludedEventFinal > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>Event Final</span>
                          <span className="font-medium">{stats.excludedEventFinal}</span>
                        </div>
                      )}
                      {stats.excludedEventPast > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>Event in Past</span>
                          <span className="font-medium">{stats.excludedEventPast}</span>
                        </div>
                      )}
                      {stats.excludedBeforeWindow > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>Event in Future</span>
                          <span className="font-medium">{stats.excludedBeforeWindow}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-medium pt-1 border-t">
                        <span>Total</span>
                        <span>{stats.streamsExcluded}</span>
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </div>

            {/* Matched - color based on match rate */}
            <div className="bg-secondary rounded px-3 py-2">
              <div className={`text-xl font-bold ${
                stats.matchRate >= 85 ? 'text-green-500' :
                stats.matchRate >= 60 ? 'text-orange-500' :
                stats.matchRate > 0 ? 'text-red-500' : ''
              }`}>
                {stats.matched}/{stats.matched + stats.failedCount}
              </div>
              <div className="text-[0.65rem] text-muted-foreground uppercase tracking-wider">
                Matched ({stats.matchRate}%)
              </div>
            </div>
        </div>
      )}

      {/* Fixed Batch Operations Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container max-w-screen-xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedIds.size} group{selectedIds.size > 1 ? "s" : ""} selected
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Clear
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkToggle(true)}>
                  Enable
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkToggle(false)}>
                  Disable
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkClearCache(true)}
                  disabled={clearCachesBulkMutation.isPending}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Clear Cache
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedIds.size === 1) {
                      const groupId = Array.from(selectedIds)[0]
                      navigate(`/event-groups/${groupId}`)
                    } else {
                      setShowBulkEdit(true)
                    }
                  }}
                  title={selectedIds.size === 1 ? "Edit group" : "Edit selected groups"}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setShowBulkDelete(true)}>
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Groups Table - No card wrapper for more compact look */}
      <div className="border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : data?.groups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No event groups configured. Create one to get started.
            </div>
          ) : (
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-5"></TableHead>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.size === sortedGroups.length && sortedGroups.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center">
                      Name <SortIcon column="name" />
                    </div>
                  </TableHead>
                  <TableHead className="text-center w-20">Ch Group</TableHead>
                  <TableHead
                    className="w-24 text-center cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("matched")}
                  >
                    <div className="flex items-center justify-center">
                      Matched <SortIcon column="matched" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="w-14 cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center">
                      Status <SortIcon column="status" />
                    </div>
                  </TableHead>
                  <TableHead className="w-28 text-right">Actions</TableHead>
                </TableRow>
                {/* Filter row */}
                <TableRow className="border-b-2 border-border">
                  <TableHead className="py-0.5 pb-1.5"></TableHead>
                  <TableHead className="py-0.5 pb-1.5"></TableHead>
                  <TableHead className="py-0.5 pb-1.5">
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="Filter..."
                        value={nameFilter}
                        onChange={(e) => setNameFilter(e.target.value)}
                        className="h-[18px] text-[0.65rem] italic px-1 pr-4 rounded-sm"
                      />
                      {nameFilter && (
                        <button
                          onClick={() => setNameFilter("")}
                          className="absolute right-0.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="py-0.5 pb-1.5"></TableHead>
                  <TableHead className="py-0.5 pb-1.5"></TableHead>
                  <TableHead className="py-0.5 pb-1.5"></TableHead>
                  <TableHead className="py-0.5 pb-1.5">
                    <FilterSelect
                      value={statusFilter}
                      onChange={(v) => setStatusFilter(v as typeof statusFilter)}
                      options={[
                        { value: "", label: "All" },
                        { value: "enabled", label: "Active" },
                        { value: "disabled", label: "Inactive" },
                      ]}
                    />
                  </TableHead>
                  <TableHead className="py-0.5 pb-1.5 text-right">
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="h-5 px-1.5">
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No groups match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                {sortedGroups.map((group) => {
                  return (
                    <React.Fragment key={group.id}>
                      <TableRow
                        className={`
                          border-l-3 border-l-transparent hover:border-l-emerald-500 group/row
                          ${draggedGroupId === group.id ? "opacity-50" : ""}
                        `}
                        draggable
                        onDragStart={(e) => handleDragStart(e, group.id)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, group.id)}
                        onDragEnd={handleDragEnd}
                      >
                        <TableCell className="w-8 p-0">
                          <div className="flex items-center justify-center h-full cursor-grab active:cursor-grabbing text-muted-foreground group-hover/row:text-emerald-500">
                            <GripVertical className="h-4 w-4" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(group.id)}
                            onCheckedChange={() => toggleSelect(group.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{getDisplayName(group)}</span>
                            {/* Account name badge */}
                            {group.m3u_account_name && (
                              <Badge
                                variant="secondary"
                                className="text-xs"
                                title={`M3U Account: ${group.m3u_account_name}`}
                              >
                                {group.m3u_account_name}
                              </Badge>
                            )}
                            {/* Regex badge */}
                            {(group.custom_regex_teams_enabled ||
                              group.custom_regex_date_enabled ||
                              group.custom_regex_time_enabled ||
                              group.stream_include_regex_enabled ||
                              group.stream_exclude_regex_enabled) && (
                              <Badge
                                variant="secondary"
                                className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs"
                                title={`Custom regex: ${[
                                  group.custom_regex_teams_enabled && "teams",
                                  group.custom_regex_date_enabled && "date",
                                  group.custom_regex_time_enabled && "time",
                                  group.stream_include_regex_enabled && "include",
                                  group.stream_exclude_regex_enabled && "exclude",
                                ].filter(Boolean).join(", ")}`}
                              >
                                Regex
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                    {/* Ch Group Column */}
                    <TableCell className="text-center">
                      {group.channel_group_mode && group.channel_group_mode !== "static" ? (
                        <Badge
                          variant="outline"
                          className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs font-mono"
                          title="Dynamic channel group"
                        >
                          {group.channel_group_mode}
                        </Badge>
                      ) : group.channel_group_id ? (
                        <Badge variant="secondary" className="text-xs" title={`ID: ${group.channel_group_id}`}>
                          {channelGroupNames[group.channel_group_id] || `#${group.channel_group_id}`}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {/* Matched Column with Progress Bar */}
                    <TableCell className="text-center">
                      {group.stream_count && group.stream_count > 0 ? (
                        <div className="flex flex-col items-center gap-0.5" title={`Last: ${group.last_refresh ? new Date(group.last_refresh).toLocaleString() : 'Never'}`}>
                          <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                (group.matched_count || 0) / group.stream_count >= 0.8
                                  ? 'bg-green-500'
                                  : (group.matched_count || 0) / group.stream_count >= 0.5
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.round(((group.matched_count || 0) / group.stream_count) * 100)}%` }}
                            />
                          </div>
                          <span className="text-[0.65rem]">
                            {group.matched_count}/{group.stream_count} ({Math.round(((group.matched_count || 0) / group.stream_count) * 100)}%)
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={group.enabled}
                        onCheckedChange={() => handleToggle(group)}
                        disabled={toggleMutation.isPending}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handlePreview(group)}
                          disabled={previewMutation.isPending}
                          title="Preview stream matches"
                        >
                          {previewMutation.isPending &&
                          previewMutation.variables === group.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setClearCacheConfirm(group)}
                          disabled={clearCacheMutation.isPending}
                          title="Clear match cache"
                        >
                          {clearCacheMutation.isPending &&
                          clearCacheMutation.variables === group.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => navigate(`/event-groups/${group.id}`)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setDeleteConfirm(group)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                    </React.Fragment>
                  )
                })}
                  </>
                )}
              </TableBody>
            </Table>
          )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <DialogContent onClose={() => setDeleteConfirm(null)}>
          <DialogHeader>
            <DialogTitle>Delete Event Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirm ? getDisplayName(deleteConfirm) : ''}"? This will
              also delete all {deleteConfirm?.channel_count ?? 0} managed
              channels associated with this group.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Cache Confirmation Dialog */}
      <Dialog
        open={clearCacheConfirm !== null}
        onOpenChange={(open) => !open && setClearCacheConfirm(null)}
      >
        <DialogContent onClose={() => setClearCacheConfirm(null)}>
          <DialogHeader>
            <DialogTitle>Clear Match Cache</DialogTitle>
            <DialogDescription>
              Clear the stream match cache for "{clearCacheConfirm ? getDisplayName(clearCacheConfirm) : ''}"?
              This will force re-matching on the next EPG generation run.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearCacheConfirm(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => clearCacheConfirm && handleClearCache(clearCacheConfirm)}
              disabled={clearCacheMutation.isPending}
            >
              {clearCacheMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Clear Cache
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Clear Cache Confirmation Dialog */}
      <Dialog open={showBulkClearCache} onOpenChange={setShowBulkClearCache}>
        <DialogContent onClose={() => setShowBulkClearCache(false)}>
          <DialogHeader>
            <DialogTitle>Clear Match Cache for {selectedIds.size} Groups</DialogTitle>
            <DialogDescription>
              Clear the stream match cache for {selectedIds.size} selected groups?
              This will force re-matching on the next EPG generation run.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkClearCache(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkClearCache}
              disabled={clearCachesBulkMutation.isPending}
            >
              {clearCachesBulkMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Clear Cache for {selectedIds.size} Groups
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Dialog */}
      <Dialog open={showBulkEdit} onOpenChange={(open) => {
        setShowBulkEdit(open)
        if (!open) resetBulkEditForm()
      }}>
        <DialogContent onClose={() => setShowBulkEdit(false)} className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Bulk Edit ({selectedIds.size} groups)</DialogTitle>
            <DialogDescription>
              Only checked fields will be updated. Use "Clear" to remove values.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 px-1 max-h-[60vh] overflow-y-auto">
            {/* Channel Group */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={bulkEditChannelGroupEnabled}
                  onCheckedChange={(checked) => {
                    setBulkEditChannelGroupEnabled(!!checked)
                    if (!checked) {
                      setBulkEditChannelGroupId(null)
                      setBulkEditChannelGroupMode('static')
                      setBulkEditClearChannelGroup(false)
                    }
                  }}
                />
                <span className="text-sm font-medium">Channel Group</span>
              </label>
              {bulkEditChannelGroupEnabled && (
                <div className="space-y-3">
                  {/* Clear option */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={bulkEditClearChannelGroup}
                      onCheckedChange={(checked) => {
                        setBulkEditClearChannelGroup(!!checked)
                        if (checked) {
                          setBulkEditChannelGroupId(null)
                          setBulkEditChannelGroupMode('static')
                        }
                      }}
                    />
                    <span className="text-xs text-muted-foreground">Clear (remove from channel group)</span>
                  </label>

                  {!bulkEditClearChannelGroup && (
                    <div className="space-y-2">
                      {/* Static group option */}
                      <div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="bulk_channel_group_mode"
                            checked={bulkEditChannelGroupMode === "static"}
                            onChange={() => setBulkEditChannelGroupMode("static")}
                            className="accent-primary"
                          />
                          <span className="text-sm">Existing group</span>
                        </label>
                        <div className={`mt-2 ml-6 ${bulkEditChannelGroupMode !== "static" ? "opacity-40 pointer-events-none" : ""}`}>
                          <Select
                            value={bulkEditChannelGroupId?.toString() ?? ""}
                            onChange={(e) => setBulkEditChannelGroupId(e.target.value ? parseInt(e.target.value) : null)}
                            disabled={bulkEditChannelGroupMode !== "static"}
                          >
                            <option value="">Select channel group...</option>
                            {channelGroups?.map((group) => (
                              <option key={group.id} value={group.id.toString()}>
                                {group.name}
                              </option>
                            ))}
                          </Select>
                        </div>
                      </div>

                      {/* Dynamic group options */}
                      <div className="border rounded-md bg-muted/30">
                        <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Dynamic Groups
                        </div>
                        <div className="divide-y">
                          <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent">
                            <input
                              type="radio"
                              name="bulk_channel_group_mode"
                              checked={bulkEditChannelGroupMode === "sport"}
                              onChange={() => {
                                setBulkEditChannelGroupMode("sport")
                                setBulkEditChannelGroupId(null)
                              }}
                              className="accent-primary"
                            />
                            <div className="flex-1">
                              <code className="text-sm font-medium bg-muted px-1 rounded">{"{sport}"}</code>
                              <p className="text-xs text-muted-foreground mt-0.5">Assign channels to a group by sport name</p>
                            </div>
                          </label>
                          <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent">
                            <input
                              type="radio"
                              name="bulk_channel_group_mode"
                              checked={bulkEditChannelGroupMode === "league"}
                              onChange={() => {
                                setBulkEditChannelGroupMode("league")
                                setBulkEditChannelGroupId(null)
                              }}
                              className="accent-primary"
                            />
                            <div className="flex-1">
                              <code className="text-sm font-medium bg-muted px-1 rounded">{"{league}"}</code>
                              <p className="text-xs text-muted-foreground mt-0.5">Assign channels to a group by league name</p>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Channel Profiles */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={bulkEditProfilesEnabled}
                  onCheckedChange={(checked) => {
                    setBulkEditProfilesEnabled(!!checked)
                    if (!checked) {
                      setBulkEditProfileIds([])
                      setBulkEditUseDefaultProfiles(true)
                    }
                  }}
                />
                <span className="text-sm font-medium">Channel Profiles</span>
              </label>
              {bulkEditProfilesEnabled && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={bulkEditUseDefaultProfiles}
                      onCheckedChange={(checked) => {
                        setBulkEditUseDefaultProfiles(!!checked)
                        if (checked) {
                          setBulkEditProfileIds([])
                        }
                      }}
                    />
                    <span className="text-sm font-normal">
                      Use default channel profiles
                    </span>
                  </label>
                  <ChannelProfileSelector
                    selectedIds={bulkEditProfileIds}
                    onChange={setBulkEditProfileIds}
                    disabled={bulkEditUseDefaultProfiles}
                  />
                  <p className="text-xs text-muted-foreground">
                    {bulkEditUseDefaultProfiles
                      ? "Using default profiles from global settings"
                      : "Select specific profiles for these groups"}
                  </p>
                </div>
              )}
            </div>

            {/* Stream Profile */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={bulkEditStreamProfileEnabled}
                  onCheckedChange={(checked) => setBulkEditStreamProfileEnabled(!!checked)}
                />
                <span className="text-sm font-medium">Stream Profile</span>
              </label>
              {bulkEditStreamProfileEnabled && (
                <div className="space-y-2 pl-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={bulkEditUseDefaultStreamProfile}
                      onCheckedChange={(checked) => {
                        setBulkEditUseDefaultStreamProfile(!!checked)
                        if (checked) {
                          setBulkEditStreamProfileId(null)
                        }
                      }}
                    />
                    <span className="text-sm font-normal">
                      Use default stream profile
                    </span>
                  </label>
                  <StreamProfileSelector
                    value={bulkEditStreamProfileId}
                    onChange={setBulkEditStreamProfileId}
                    disabled={bulkEditUseDefaultStreamProfile}
                  />
                  <p className="text-xs text-muted-foreground">
                    {bulkEditUseDefaultStreamProfile
                      ? "Using default stream profile from global settings"
                      : "Select specific stream profile for these groups"}
                  </p>
                </div>
              )}
            </div>

            {/* Stream Timezone */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={bulkEditStreamTimezoneEnabled}
                  onCheckedChange={(checked) => setBulkEditStreamTimezoneEnabled(!!checked)}
                />
                <span className="text-sm font-medium">Stream Timezone</span>
              </label>
              {bulkEditStreamTimezoneEnabled && (
                <div className="space-y-2 pl-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={bulkEditClearStreamTimezone}
                      onCheckedChange={(checked) => {
                        setBulkEditClearStreamTimezone(!!checked)
                        if (checked) {
                          setBulkEditStreamTimezone(null)
                        }
                      }}
                    />
                    <span className="text-sm font-normal">
                      Auto-detect from stream
                    </span>
                  </label>
                  <StreamTimezoneSelector
                    value={bulkEditStreamTimezone}
                    onChange={setBulkEditStreamTimezone}
                    disabled={bulkEditClearStreamTimezone}
                  />
                  <p className="text-xs text-muted-foreground">
                    Timezone used in stream names for date matching
                  </p>
                </div>
              )}
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkEdit(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkEdit}
              disabled={bulkUpdateMutation.isPending || (!bulkEditChannelGroupEnabled && !bulkEditProfilesEnabled && !bulkEditStreamProfileEnabled && !bulkEditStreamTimezoneEnabled)}
            >
              {bulkUpdateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Apply to {selectedIds.size} groups
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
        <DialogContent onClose={() => setShowBulkDelete(false)}>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} Groups</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedIds.size} groups? This will
              also delete all managed channels associated with these groups.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete {selectedIds.size} Groups
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stream Preview Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent onClose={() => setShowPreviewModal(false)} className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Stream Preview: {previewData?.group_name}
            </DialogTitle>
            <DialogDescription>
              Preview of stream matching results. Processing is done via EPG generation.
            </DialogDescription>
          </DialogHeader>

          {previewData && (
            <div className="flex-1 overflow-hidden flex flex-col gap-4">
              {/* Summary stats */}
              <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg text-sm">
                <span>{previewData.total_streams} streams</span>
                <span className="text-muted-foreground">|</span>
                <span className="text-green-600 dark:text-green-400">
                  {previewData.matched_count} matched
                </span>
                <span className="text-muted-foreground">|</span>
                <span className="text-amber-600 dark:text-amber-400">
                  {previewData.unmatched_count} unmatched
                </span>
                {previewData.filtered_count > 0 && (
                  <>
                    <span className="text-muted-foreground">|</span>
                    <span className="text-muted-foreground">
                      {previewData.filtered_count} filtered
                    </span>
                  </>
                )}
                {previewData.cache_hits > 0 && (
                  <>
                    <span className="text-muted-foreground">|</span>
                    <span className="text-muted-foreground">
                      {previewData.cache_hits}/{previewData.cache_hits + previewData.cache_misses} cached
                    </span>
                  </>
                )}
              </div>

              {/* Errors */}
              {previewData.errors.length > 0 && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                  {previewData.errors.map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                </div>
              )}

              {/* Stream table */}
              <div className="flex-1 overflow-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">Status</TableHead>
                      <TableHead className="w-[40%]">Stream Name</TableHead>
                      <TableHead>League</TableHead>
                      <TableHead>Event Match</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.streams.map((stream, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          {stream.matched ? (
                            <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {stream.stream_name}
                        </TableCell>
                        <TableCell>
                          {stream.league ? (
                            <Badge variant="secondary">{getLeagueDisplay(stream.league)}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {stream.matched ? (
                            <div className="text-sm">
                              <div className="font-medium">{stream.event_name}</div>
                              {stream.start_time && (
                                <div className="text-muted-foreground text-xs">
                                  {new Date(stream.start_time).toLocaleString()}
                                </div>
                              )}
                            </div>
                          ) : stream.exclusion_reason ? (
                            <span className="text-muted-foreground text-xs">
                              {stream.exclusion_reason}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">No match</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {previewData.streams.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No streams to display
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
