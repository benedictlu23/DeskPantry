import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  Edit3,
  ExternalLink,
  Grid,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { InternalApp, UserRole } from '../types';
import { compressImageFileToDataUrl } from '../utils/image';
import { ProductImage } from './ProductImage';

interface OtherAppsViewProps {
  apps: InternalApp[];
  currentRole: UserRole;
  onToggleInstallApp: (appId: string) => void;
  onSaveApp: (app: InternalApp) => Promise<void>;
  onDeleteApp: (appId: string) => Promise<void>;
}

function getSafeHttpUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed === '#') return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export const OtherAppsView: React.FC<OtherAppsViewProps> = ({
  apps,
  currentRole,
  onToggleInstallApp,
  onSaveApp,
  onDeleteApp,
}) => {
  const canManageApps =
    currentRole === UserRole.Admin || currentRole === UserRole.SuperAdmin;

  const [launchedApp, setLaunchedApp] = useState<InternalApp | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<InternalApp | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [banner, setBanner] = useState('');
  const [formError, setFormError] = useState('');

  // Form fields
  const [nameInput, setNameInput] = useState('');
  const [taglineInput, setTaglineInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [platformInput, setPlatformInput] = useState('Web Workspace');
  const [versionInput, setVersionInput] = useState('v1.0');
  const [urlInput, setUrlInput] = useState('');
  const [imageInput, setImageInput] = useState('');
  const [actionTypeInput, setActionTypeInput] = useState<'open' | 'install'>('open');

  const showToast = (msg: string) => {
    setBanner(msg);
    setTimeout(() => {
      setBanner((prev) => (prev === msg ? '' : prev));
    }, 4500);
  };

  const openCreateModal = () => {
    setEditingApp(null);
    setNameInput('');
    setTaglineInput('');
    setDescInput('');
    setPlatformInput('Web Workspace');
    setVersionInput('v1.0');
    setUrlInput('');
    setImageInput('');
    setActionTypeInput('open');
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditModal = (app: InternalApp) => {
    setEditingApp(app);
    setNameInput(app.name);
    setTaglineInput(app.tagline);
    setDescInput(app.description);
    setPlatformInput(app.platform);
    setVersionInput(app.version);
    setUrlInput(app.url === '#' ? '' : app.url);
    setImageInput(app.image);
    setActionTypeInput(app.actionType);
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageApps) return;
    const cleanName = nameInput.trim();
    const cleanDesc = descInput.trim();
    if (!cleanName) {
      setFormError('App title is required.');
      return;
    }
    if (!cleanDesc) {
      setFormError('Description is required.');
      return;
    }

    const rawUrl = urlInput.trim();
    let finalUrl = '#';
    if (rawUrl) {
      const safeUrl = getSafeHttpUrl(rawUrl);
      if (!safeUrl) {
        setFormError('Link must start with https:// or http:// (or leave blank for preview mode).');
        return;
      }
      finalUrl = safeUrl;
    }

    const cleanImg = imageInput.trim();
    if (cleanImg && !cleanImg.startsWith('data:image/') && !getSafeHttpUrl(cleanImg)) {
      setFormError('Image must be an uploaded photo or a valid https:// / http:// image URL.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const payload: InternalApp = {
        id: editingApp?.id ?? `app-${Date.now()}`,
        name: cleanName.slice(0, 120),
        tagline: (taglineInput.trim() || 'Department Workspace Tool').slice(0, 200),
        description: cleanDesc.slice(0, 500),
        platform: (platformInput.trim() || 'Web Workspace').slice(0, 80),
        version: (versionInput.trim() || 'v1.0').slice(0, 40),
        actionType: actionTypeInput,
        installed: editingApp ? editingApp.installed : actionTypeInput === 'open',
        image: cleanImg,
        url: finalUrl,
      };
      await onSaveApp(payload);
      setIsFormOpen(false);
      setEditingApp(null);
      showToast(
        editingApp
          ? `Updated department app "${payload.name}".`
          : `Added "${payload.name}" to Department Apps.`
      );
    } catch {
      setFormError('Could not save department app. Please check Admin permissions and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async (app: InternalApp) => {
    setDeletingId(app.id);
    try {
      await onDeleteApp(app.id);
      setConfirmDeleteId(null);
      showToast(`Removed "${app.name}" from Department Apps.`);
    } catch {
      setBanner(`Failed to remove "${app.name}". Check Admin permissions.`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
            Other Department Apps
          </h1>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            Internal workplace tools and links managed alongside DeskPantry.
          </p>
        </div>

        {canManageApps && (
          <button
            type="button"
            onClick={openCreateModal}
            className="min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Department App</span>
          </button>
        )}
      </div>

      {banner && (
        <div className="flex items-center justify-between gap-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{banner}</span>
          </span>
          <button
            type="button"
            onClick={() => setBanner('')}
            className="text-xs font-semibold hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {apps.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-10 text-center space-y-3">
          <Grid className="w-8 h-8 text-stone-400 mx-auto" />
          <div className="text-base font-bold text-stone-900 dark:text-stone-100">
            No department apps listed yet
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto">
            {canManageApps
              ? 'Add internal portals, forms, sheets, or tools with a title, description, image, and link.'
              : 'Admins can add department links and workplace tools here.'}
          </p>
          {canManageApps && (
            <button
              type="button"
              onClick={openCreateModal}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Department App</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {apps.map((app) => {
            const safeUrl = getSafeHttpUrl(app.url);
            const isDeletingThis = confirmDeleteId === app.id;
            return (
              <article
                key={app.id}
                className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-[4/3] bg-stone-100 dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 relative">
                    <ProductImage
                      src={app.image}
                      alt={app.name}
                      title={app.name}
                      className="w-full h-full object-cover"
                    />
                    {canManageApps && (
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(app)}
                          className="min-h-[32px] min-w-[32px] rounded-lg bg-white/90 dark:bg-[#121D1B]/90 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:text-teal-700 dark:hover:text-teal-300 flex items-center justify-center shadow-xs cursor-pointer"
                          title={`Edit ${app.name}`}
                          aria-label={`Edit ${app.name}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(isDeletingThis ? null : app.id)}
                          className="min-h-[32px] min-w-[32px] rounded-lg bg-white/90 dark:bg-[#121D1B]/90 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:text-red-600 dark:hover:text-red-400 flex items-center justify-center shadow-xs cursor-pointer"
                          title={`Remove ${app.name}`}
                          aria-label={`Remove ${app.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="text-xs text-stone-500 dark:text-stone-400">
                      {app.platform} · Release {app.version}
                    </div>
                    <h2 className="mt-1 text-lg font-bold text-stone-900 dark:text-stone-100">
                      {app.name}
                    </h2>
                    <div className="text-xs font-semibold text-teal-700 dark:text-teal-400 mt-0.5">
                      {app.tagline}
                    </div>
                    <p className="mt-2 text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                      {app.description}
                    </p>
                    {safeUrl && (
                      <div className="mt-2 text-[11px] font-mono text-stone-500 dark:text-stone-400 truncate">
                        {safeUrl}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-5 pb-5 pt-2 space-y-2">
                  {isDeletingThis && (
                    <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-2.5 flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-red-800 dark:text-red-200">
                        Delete app?
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2.5 py-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#121D1B] text-stone-700 dark:text-stone-200 font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === app.id}
                          onClick={() => void handleConfirmDelete(app)}
                          className="px-2.5 py-1 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                        >
                          {deletingId === app.id ? 'Removing...' : 'Confirm'}
                        </button>
                      </div>
                    </div>
                  )}

                  {app.actionType === 'install' && !app.installed ? (
                    <button
                      type="button"
                      onClick={() => onToggleInstallApp(app.id)}
                      className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Install App</span>
                    </button>
                  ) : safeUrl ? (
                    <a
                      href={safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-900 dark:bg-[#172523] px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800 dark:hover:bg-teal-700 cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Open {app.name}</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setLaunchedApp(app)}
                      className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-900 dark:bg-[#172523] px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800 dark:hover:bg-teal-700 cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Open {app.name}</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Workspace Preview Modal (when no external URL is configured) */}
      {launchedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  {launchedApp.name}
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {launchedApp.platform} · Release {launchedApp.version}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLaunchedApp(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/50 p-4 flex items-start gap-2.5 text-sm text-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">{launchedApp.name} workspace ready</div>
                <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-1">
                  {launchedApp.description}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLaunchedApp(null)}
              className="w-full min-h-[44px] rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 cursor-pointer"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit Department App Modal (Admin / Super Admin) */}
      {isFormOpen && canManageApps && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs overflow-y-auto">
          <form
            onSubmit={handleSaveSubmit}
            className="w-full max-w-lg rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6 shadow-2xl space-y-4 my-auto"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  {editingApp ? `Edit ${editingApp.name}` : 'Add Department App'}
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Configure app title, description, cover image, and external workspace link.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  App Title *
                </label>
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Shift Tracker Portal"
                  className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm text-stone-900 dark:text-stone-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Tagline
                </label>
                <input
                  type="text"
                  value={taglineInput}
                  onChange={(e) => setTaglineInput(e.target.value)}
                  placeholder="e.g. Team Attendance & PTO"
                  className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Description *
              </label>
              <textarea
                required
                rows={3}
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                placeholder="Describe what coworkers use this department app for..."
                className="w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm text-stone-900 dark:text-stone-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                App Link (https:// or http://)
              </label>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://workspace.company.ph/app"
                className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm font-mono text-stone-900 dark:text-stone-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Platform
                </label>
                <input
                  type="text"
                  value={platformInput}
                  onChange={(e) => setPlatformInput(e.target.value)}
                  placeholder="Web Workspace"
                  className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-xs text-stone-900 dark:text-stone-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Version
                </label>
                <input
                  type="text"
                  value={versionInput}
                  onChange={(e) => setVersionInput(e.target.value)}
                  placeholder="v1.0"
                  className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-xs font-mono text-stone-900 dark:text-stone-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Button Mode
                </label>
                <select
                  value={actionTypeInput}
                  onChange={(e) => setActionTypeInput(e.target.value as 'open' | 'install')}
                  className="w-full min-h-[40px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-xs font-semibold text-stone-900 dark:text-stone-100"
                >
                  <option value="open">Open Link</option>
                  <option value="install">Install First</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                App Cover Image (Upload or URL)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <label className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#172523] px-3 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-200 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                  <span>Upload Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      void compressImageFileToDataUrl(f, 720, 0.72).then((compressed) => {
                        setImageInput(compressed);
                      });
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
                <input
                  type="text"
                  value={imageInput.startsWith('data:image/') ? '' : imageInput}
                  onChange={(e) => setImageInput(e.target.value)}
                  placeholder="Or paste https:// image URL..."
                  className="flex-1 min-w-[180px] min-h-[38px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 text-xs text-stone-900 dark:text-stone-100"
                />
                {imageInput && (
                  <button
                    type="button"
                    onClick={() => setImageInput('')}
                    className="min-h-[38px] px-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs text-stone-500 hover:text-red-600 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              {imageInput && (
                <img
                  src={imageInput}
                  alt="App cover preview"
                  className="w-24 h-16 rounded-lg object-cover border border-stone-200 dark:border-stone-700"
                />
              )}
            </div>

            {formError && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400">{formError}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-600 dark:text-stone-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-teal-700 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Saving...' : editingApp ? 'Save Changes' : 'Add App'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
