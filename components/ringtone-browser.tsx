"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Music,
  Volume2,
  Search,
  Upload,
  Heart,
  Check,
  X,
  Settings,
  ChevronDown,
  Trash2,
  Play,
  RotateCcw,
} from "lucide-react";
import type { State, Settings as SettingsType, CustomRingtone } from "../core/model";
import { ringtones, type Ringtone } from "../core/ringtones";

type RingtoneItem = {
  id: string;
  name: string;
  category: "builtin" | "custom";
  durationStr: string;
  durationSec: number;
  data?: string;
  notes?: readonly number[];
};

const BUILTIN_DURATIONS: Record<string, string> = {
  classic: "00:01",
  woodland: "00:01",
  raindrop: "00:01",
  sunrise: "00:01",
  "bright-bell": "00:01",
  "morning-call": "00:01",
  "focus-alarm": "00:01",
  "ulah-oscar": "00:02",
};

function formatDuration(sec?: number): string {
  if (!sec || isNaN(sec) || sec <= 0) return "00:05";
  const mins = Math.floor(sec / 60);
  const secs = Math.floor(sec % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

const PASTEL_COLORS = [
  "#dbe7d3", // sage
  "#d8e6ec", // soft blue
  "#fae5d8", // peach
  "#ede3f5", // lavender
  "#fcecd2", // soft amber
  "#f7dddc", // rose
];

function getBadgeColor(index: number): string {
  return PASTEL_COLORS[index % PASTEL_COLORS.length];
}

interface RingtoneBrowserProps {
  settings: SettingsType;
  onUpdate: (updater: (s: State) => void) => Promise<boolean>;
  onPreview: (settings: SettingsType) => Promise<void>;
  onError: (msg: string) => void;
  onNotice: (msg: string) => void;
  readAsDataUrl: (file: File) => Promise<string>;
}

export default function RingtoneBrowser({
  settings,
  onUpdate,
  onPreview,
  onError,
  onNotice,
  readAsDataUrl,
}: RingtoneBrowserProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "favorites" | "custom" | "builtin">("all");
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  // Close popover on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Combine custom ringtones
  const customList: CustomRingtone[] = useMemo(() => {
    const list = [...(settings.customRingtones || [])];
    if (
      settings.customRingtone &&
      !list.some((r) => r.id === "custom")
    ) {
      list.push({
        id: "custom",
        name: "My uploaded audio",
        data: settings.customRingtone,
        duration: 5,
      });
    }
    return list;
  }, [settings.customRingtones, settings.customRingtone]);

  // All ringtone items normalized
  const allItems: RingtoneItem[] = useMemo(() => {
    const builtins: RingtoneItem[] = ringtones.map((r) => ({
      id: r.id,
      name: r.name,
      category: "builtin",
      durationStr: BUILTIN_DURATIONS[r.id] || "00:01",
      durationSec: r.id === "ulah-oscar" ? 2 : 1,
    }));

    const customs: RingtoneItem[] = customList.map((cr) => ({
      id: cr.id,
      name: cr.name,
      category: "custom",
      durationStr: formatDuration(cr.duration),
      durationSec: cr.duration || 5,
      data: cr.data,
    }));

    return [...builtins, ...customs];
  }, [customList]);

  // Active ringtone object
  const activeItem = useMemo(() => {
    return (
      allItems.find((r) => r.id === settings.ringtone) ||
      allItems[0] || { id: "classic", name: "Gentle chime", durationStr: "00:01" }
    );
  }, [allItems, settings.ringtone]);

  // Favorites set
  const favorites = useMemo(() => {
    return new Set(settings.ringtoneFavorites || []);
  }, [settings.ringtoneFavorites]);

  // Recents list
  const recentItems = useMemo(() => {
    const recents = settings.recentRingtones || [];
    return recents
      .map((id) => allItems.find((item) => item.id === id))
      .filter((item): item is RingtoneItem => Boolean(item));
  }, [settings.recentRingtones, allItems]);

  // Filtered items based on tab and search
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      // Tab filter
      if (activeTab === "favorites" && !favorites.has(item.id)) return false;
      if (activeTab === "custom" && item.category !== "custom") return false;
      if (activeTab === "builtin" && item.category !== "builtin") return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return item.name.toLowerCase().includes(q);
      }

      return true;
    });
  }, [allItems, activeTab, favorites, searchQuery]);

  // Counts for tabs
  const tabCounts = useMemo(() => {
    return {
      all: allItems.length,
      favorites: allItems.filter((r) => favorites.has(r.id)).length,
      custom: customList.length,
      builtin: ringtones.length,
    };
  }, [allItems, favorites, customList]);

  // Select a ringtone
  const handleSelectRingtone = async (item: RingtoneItem) => {
    const currentRecents = settings.recentRingtones || [];
    const nextRecents = [item.id, ...currentRecents.filter((id) => id !== item.id)].slice(0, 8);

    await onUpdate((s) => {
      s.settings.ringtone = item.id as Ringtone;
      s.settings.recentRingtones = nextRecents;
      s.settings.sound = true;
    });

    try {
      await onPreview({
        ...settings,
        ringtone: item.id as Ringtone,
        sound: true,
      });
    } catch {}
  };

  // Toggle favorite
  const handleToggleFavorite = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const currentFavs = new Set(settings.ringtoneFavorites || []);
    if (currentFavs.has(id)) {
      currentFavs.delete(id);
    } else {
      currentFavs.add(id);
    }
    await onUpdate((s) => {
      s.settings.ringtoneFavorites = Array.from(currentFavs);
    });
  };

  // Upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      const isAudio =
        file.type.startsWith("audio/") ||
        /\.(mp3|wav|ogg|m4a|aac|webm|flac)$/i.test(file.name);

      if (!isAudio || file.size > 5 * 1024 * 1024) {
        throw new Error("Choose an audio file (MP3, WAV, OGG, or M4A) under 5 MB.");
      }

      const dataUrl = await readAsDataUrl(file);

      // Measure duration
      let durationSec = 5;
      try {
        const audioEl = new Audio();
        audioEl.src = dataUrl;
        await new Promise<void>((resolve) => {
          audioEl.onloadedmetadata = () => {
            if (audioEl.duration && isFinite(audioEl.duration)) {
              durationSec = Math.round(audioEl.duration);
            }
            resolve();
          };
          audioEl.onerror = () => resolve();
          setTimeout(resolve, 800);
        });
      } catch {}

      const cleanName =
        file.name.replace(/\.[^/.]+$/, "").slice(0, 30) || "Uploaded sound";
      const newId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newEntry: CustomRingtone = {
        id: newId,
        name: cleanName,
        data: dataUrl,
        duration: durationSec,
      };

      const currentRecents = settings.recentRingtones || [];
      const nextRecents = [newId, ...currentRecents.filter((id) => id !== newId)].slice(0, 8);

      if (
        await onUpdate((s) => {
          const existing = s.settings.customRingtones || [];
          s.settings.customRingtones = [...existing, newEntry];
          s.settings.ringtone = newId as Ringtone;
          s.settings.recentRingtones = nextRecents;
          s.settings.sound = true;
        })
      ) {
        await onPreview({
          ...settings,
          ringtone: newId as Ringtone,
          customRingtones: [...(settings.customRingtones || []), newEntry],
          sound: true,
        });
        onNotice(`"${cleanName}" uploaded and selected as your ringtone.`);
      }
    } catch (error) {
      onError((error as Error).message);
    } finally {
      e.target.value = "";
    }
  };

  // Delete custom ringtone
  const handleDeleteCustom = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const target = customList.find((r) => r.id === id);
    if (!target) return;

    if (
      target.data &&
      target.data.startsWith("pacana://app/audio/") &&
      typeof window !== "undefined" &&
      (window as any).pacanaDesktop?.deleteAudio
    ) {
      const audioId = target.data.replace("pacana://app/audio/", "");
      await (window as any).pacanaDesktop.deleteAudio(audioId).catch(() => {});
    }

    await onUpdate((s) => {
      s.settings.customRingtones = (s.settings.customRingtones || []).filter(
        (r) => r.id !== id,
      );
      if (s.settings.customRingtone && id === "custom") {
        delete s.settings.customRingtone;
      }
      if (s.settings.ringtone === id) {
        s.settings.ringtone = "classic";
      }
      s.settings.ringtoneFavorites = (s.settings.ringtoneFavorites || []).filter(
        (favId) => favId !== id,
      );
      s.settings.recentRingtones = (s.settings.recentRingtones || []).filter(
        (recId) => recId !== id,
      );
    });

    onNotice(`"${target.name}" removed from ringtones.`);
  };

  return (
    <div className="ringtone-browser-container">
      {/* 1. Selector Trigger Row */}
      <div className="ringtone-picker-row">
        <button
          type="button"
          ref={triggerRef}
          className={`ringtone-selector-btn ${isOpen ? "is-open" : ""}`}
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <div className="selector-content">
            <span className="selector-icon">
              <Music size={16} />
            </span>
            <span className="selector-name">{activeItem.name}</span>
          </div>
          <ChevronDown
            size={16}
            className={`selector-chevron ${isOpen ? "is-rotated" : ""}`}
          />
        </button>

        <label className="upload-ringtone-trigger-btn">
          <Upload size={16} />
          <span>Upload ringtones</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm,.mp3,.wav,.ogg,.m4a,.webm,.aac,.flac"
            onChange={handleFileUpload}
          />
        </label>
      </div>

      {/* 2. Ringtone Preview Action */}
      <div className="ringtone-sub-actions">
        <button
          type="button"
          className="preview-btn"
          onClick={async () => {
            try {
              await onPreview(settings);
            } catch (err) {
              onError(
                (err as Error)?.message ||
                  "Sound could not play. Check your browser audio permissions and device volume.",
              );
            }
          }}
        >
          <Volume2 size={16} />
          <span>Preview ringtone</span>
        </button>
      </div>

      {/* 3. Dropdown Popover Browser */}
      {isOpen && (
        <div className="ringtone-popover" ref={popoverRef} role="dialog">
          {/* Header with Search & Upload New */}
          <div className="popover-header">
            <div className="search-bar">
              <Search size={15} className="search-icon" />
              <input
                type="text"
                placeholder="Search ringtones..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() => setSearchQuery("")}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <label className="popover-upload-btn">
              <Upload size={14} />
              <span>Upload new</span>
              <input
                type="file"
                accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm,.mp3,.wav,.ogg,.m4a,.webm,.aac,.flac"
                onChange={handleFileUpload}
              />
            </label>
          </div>

          {/* Category Filter Tabs */}
          <div className="popover-tabs">
            <button
              type="button"
              className={`tab-btn ${activeTab === "all" ? "is-active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              All ({tabCounts.all})
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === "favorites" ? "is-active" : ""}`}
              onClick={() => setActiveTab("favorites")}
            >
              Favorites ({tabCounts.favorites})
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === "custom" ? "is-active" : ""}`}
              onClick={() => setActiveTab("custom")}
            >
              Custom ({tabCounts.custom})
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === "builtin" ? "is-active" : ""}`}
              onClick={() => setActiveTab("builtin")}
            >
              Built-in ({tabCounts.builtin})
            </button>
          </div>

          {/* Scrollable List Area */}
          <div className="popover-list-body">
            {/* Recently Used Section (when in All or Favorites and no active search) */}
            {activeTab === "all" && !searchQuery.trim() && recentItems.length > 0 && (
              <div className="list-section">
                <div className="section-header">RECENTLY USED</div>
                {recentItems.slice(0, 4).map((item, idx) => {
                  const isSelected = item.id === settings.ringtone;
                  const isFav = favorites.has(item.id);
                  return (
                    <div
                      key={`recent-${item.id}`}
                      className={`ringtone-row ${isSelected ? "is-selected" : ""}`}
                      onClick={() => handleSelectRingtone(item)}
                    >
                      <div
                        className="row-avatar"
                        style={{ background: getBadgeColor(idx) }}
                      >
                        <Music size={14} />
                      </div>
                      <span className="row-name">{item.name}</span>
                      <span className="row-duration">{item.durationStr}</span>
                      <button
                        type="button"
                        className={`row-action-btn fav-btn ${isFav ? "is-fav" : ""}`}
                        title={isFav ? "Remove favorite" : "Add to favorites"}
                        onClick={(e) => handleToggleFavorite(e, item.id)}
                      >
                        <Heart
                          size={15}
                          fill={isFav ? "currentColor" : "none"}
                        />
                      </button>
                      {isSelected && (
                        <div className="selected-indicator">
                          <Check size={16} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Main Ringtones List */}
            <div className="list-section">
              <div className="section-header">
                {activeTab === "all"
                  ? "ALL RINGTONES"
                  : activeTab === "favorites"
                    ? "FAVORITE RINGTONES"
                    : activeTab === "custom"
                      ? "CUSTOM RINGTONES"
                      : "BUILT-IN RINGTONES"}
              </div>

              {filteredItems.length === 0 ? (
                <div className="empty-state">
                  <p>No ringtones found</p>
                  {activeTab === "favorites" ? (
                    <span>Click the heart icon on any sound to save it here.</span>
                  ) : activeTab === "custom" ? (
                    <span>Upload your own MP3 or audio sound to get started.</span>
                  ) : (
                    <span>Try searching for something else.</span>
                  )}
                </div>
              ) : (
                filteredItems.map((item, idx) => {
                  const isSelected = item.id === settings.ringtone;
                  const isFav = favorites.has(item.id);
                  const isCustom = item.category === "custom";

                  return (
                    <div
                      key={item.id}
                      className={`ringtone-row ${isSelected ? "is-selected" : ""}`}
                      onClick={() => handleSelectRingtone(item)}
                    >
                      <div
                        className="row-avatar"
                        style={{ background: getBadgeColor(idx) }}
                      >
                        <Music size={14} />
                      </div>
                      <span className="row-name">{item.name}</span>
                      <span className="row-duration">{item.durationStr}</span>

                      {/* Favorite button */}
                      <button
                        type="button"
                        className={`row-action-btn fav-btn ${isFav ? "is-fav" : ""}`}
                        title={isFav ? "Remove favorite" : "Add to favorites"}
                        onClick={(e) => handleToggleFavorite(e, item.id)}
                      >
                        <Heart
                          size={15}
                          fill={isFav ? "currentColor" : "none"}
                        />
                      </button>

                      {/* Delete button for custom files */}
                      {isCustom && (
                        <button
                          type="button"
                          className="row-action-btn delete-btn"
                          title="Delete uploaded sound"
                          onClick={(e) => handleDeleteCustom(e, item.id)}
                        >
                          <X size={14} />
                        </button>
                      )}

                      {/* Selected indicator */}
                      {isSelected && (
                        <div className="selected-indicator">
                          <Check size={16} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer: Manage Ringtones */}
          <div className="popover-footer">
            <button
              type="button"
              className="manage-ringtones-btn"
              onClick={() => {
                setIsOpen(false);
                setIsManageModalOpen(true);
              }}
            >
              <div className="manage-label">
                <Settings size={15} />
                <span>Manage ringtones ({customList.length})</span>
              </div>
              <span className="manage-arrow">›</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Full Ringtone Manager Modal */}
      {isManageModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setIsManageModalOpen(false)}
        >
          <div
            className="modal ringtone-manager-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <div className="modal-title-row">
                <Music size={22} className="modal-icon" />
                <div>
                  <h3>Manage Ringtones</h3>
                  <p>Organize, preview, and delete your uploaded audio files</p>
                </div>
              </div>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setIsManageModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="manager-toolbar">
              <span className="manager-count">
                {customList.length} custom sound{customList.length === 1 ? "" : "s"} uploaded
              </span>
              <label className="modal-upload-btn">
                <Upload size={14} />
                <span>Upload audio file</span>
                <input
                  ref={modalFileInputRef}
                  type="file"
                  accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm,.mp3,.wav,.ogg,.m4a,.webm,.aac,.flac"
                  onChange={handleFileUpload}
                />
              </label>
            </div>

            <div className="manager-list">
              {customList.length === 0 ? (
                <div className="manager-empty">
                  <Music size={36} />
                  <h4>No custom ringtones yet</h4>
                  <p>Upload your favorite focus chimes or alarms to use them in Pacana.</p>
                </div>
              ) : (
                customList.map((cr) => {
                  const isCurrent = cr.id === settings.ringtone;
                  return (
                    <div
                      key={cr.id}
                      className={`manager-row ${isCurrent ? "is-active" : ""}`}
                    >
                      <div className="manager-row-info">
                        <div className="manager-row-title">
                          <strong>{cr.name}</strong>
                          {isCurrent && (
                            <span className="active-tag">Active</span>
                          )}
                        </div>
                        <span className="manager-row-sub">
                          Duration: {formatDuration(cr.duration)}
                        </span>
                      </div>

                      <div className="manager-row-actions">
                        <button
                          type="button"
                          className="action-icon-btn preview"
                          title="Preview this sound"
                          onClick={async () => {
                            try {
                              await onPreview({
                                ...settings,
                                ringtone: cr.id as Ringtone,
                                customRingtones: customList,
                              });
                            } catch (err) {
                              onError((err as Error).message);
                            }
                          }}
                        >
                          <Play size={15} />
                        </button>

                        {!isCurrent ? (
                          <button
                            type="button"
                            className="action-text-btn"
                            onClick={() =>
                              handleSelectRingtone({
                                id: cr.id,
                                name: cr.name,
                                category: "custom",
                                durationStr: formatDuration(cr.duration),
                                durationSec: cr.duration || 5,
                                data: cr.data,
                              })
                            }
                          >
                            Set active
                          </button>
                        ) : null}

                        <button
                          type="button"
                          className="action-icon-btn delete"
                          title="Delete this ringtone"
                          onClick={(e) => handleDeleteCustom(e, cr.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="modal-done-btn"
                onClick={() => setIsManageModalOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
