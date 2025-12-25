import React, { useState, useEffect, useCallback } from 'react';
import type { AppProps } from './types';

type TabType = 'discover' | 'installed' | 'updates';

export interface AppManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  icon: string;
  category: 'productivity' | 'utilities' | 'entertainment' | 'developer' | 'system';
  author: string;
  repository: string;
  minSdkVersion: string;
  permissions: string[];
  installable?: boolean;
  main?: string;
}

export interface InstalledApp extends AppManifest {
  installedAt: string;
  installedVersion: string;
  source: 'bundled' | 'github' | 'local';
}

export interface AppUpdate {
  id: string;
  currentVersion: string;
  latestVersion: string;
  releaseNotes?: string;
}

// GitHub organization for zOS apps
const GITHUB_ORG = 'zos-apps';
const STORAGE_KEY = 'zos:apps:installed';

/**
 * Fetch available apps from GitHub zos-apps organization
 * Reads app metadata from package.json "zos" field
 */
async function fetchZosApps(): Promise<AppManifest[]> {
  try {
    // Fetch all repos from the organization
    const response = await fetch(`https://api.github.com/orgs/${GITHUB_ORG}/repos?per_page=100`);
    if (!response.ok) throw new Error('Failed to fetch repos');

    const repos = await response.json();
    const apps: AppManifest[] = [];

    // Fetch package.json from each repo
    for (const repo of repos) {
      if (repo.name.startsWith('.')) continue;

      try {
        const pkgResponse = await fetch(
          `https://raw.githubusercontent.com/${GITHUB_ORG}/${repo.name}/main/package.json`
        );

        if (pkgResponse.ok) {
          const pkg = await pkgResponse.json();

          // Check for zos field in package.json
          if (pkg.zos) {
            apps.push({
              id: pkg.zos.id || `ai.hanzo.${repo.name}`,
              name: pkg.zos.name || pkg.name?.replace('@zos-apps/', '') || repo.name,
              version: pkg.version || '1.0.0',
              description: pkg.description || '',
              icon: pkg.zos.icon || '📦',
              category: pkg.zos.category || 'utilities',
              author: pkg.author || 'Hanzo AI',
              repository: `https://github.com/${GITHUB_ORG}/${repo.name}`,
              minSdkVersion: pkg.zos.minSdkVersion || '4.0.0',
              permissions: pkg.zos.permissions || [],
              installable: pkg.zos.installable !== false,
              main: pkg.main || 'src/index.tsx',
            });
          }
        }
      } catch {
        // Skip repos without valid package.json
      }
    }

    return apps;
  } catch (e) {
    console.error('[zOS App Store] Failed to fetch apps:', e);
    return [];
  }
}

/**
 * Check for available updates
 */
async function checkForUpdates(installedApps: InstalledApp[]): Promise<AppUpdate[]> {
  const updates: AppUpdate[] = [];

  try {
    const availableApps = await fetchZosApps();

    for (const installed of installedApps) {
      const available = availableApps.find(a => a.id === installed.id);
      if (available && compareVersions(installed.installedVersion, available.version) < 0) {
        updates.push({
          id: installed.id,
          currentVersion: installed.installedVersion,
          latestVersion: available.version,
        });
      }
    }
  } catch (e) {
    console.error('[zOS App Store] Failed to check updates:', e);
  }

  return updates;
}

/**
 * Compare semantic versions
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }

  return 0;
}

/**
 * Load installed apps from storage
 */
function loadInstalledApps(): InstalledApp[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('[zOS App Store] Failed to load apps:', e);
  }

  return [];
}

/**
 * Save installed apps to storage
 */
function saveInstalledApps(apps: InstalledApp[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
  } catch (e) {
    console.error('[zOS App Store] Failed to save apps:', e);
  }
}

const ZAppStore: React.FC<AppProps> = ({ className }) => {
  const [availableApps, setAvailableApps] = useState<AppManifest[]>([]);
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [updates, setUpdates] = useState<AppUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load installed apps from storage
      const installed = loadInstalledApps();
      setInstalledApps(installed);

      // Fetch available apps from GitHub
      const apps = await fetchZosApps();
      setAvailableApps(apps);

      // Check for updates
      const appUpdates = await checkForUpdates(installed);
      setUpdates(appUpdates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load apps');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInstall = async (app: AppManifest) => {
    setInstalling(app.id);
    try {
      const installedApp: InstalledApp = {
        ...app,
        installedAt: new Date().toISOString(),
        installedVersion: app.version,
        source: 'github',
      };

      const newInstalledApps = [...installedApps, installedApp];
      setInstalledApps(newInstalledApps);
      saveInstalledApps(newInstalledApps);

      // Dispatch event for UI updates
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('zos:app-installed', { detail: installedApp }));
      }
    } catch (err) {
      alert(`Failed to install ${app.name}`);
    } finally {
      setInstalling(null);
    }
  };

  const handleUninstall = (id: string) => {
    const newInstalledApps = installedApps.filter(a => a.id !== id);
    setInstalledApps(newInstalledApps);
    saveInstalledApps(newInstalledApps);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('zos:app-uninstalled', { detail: { id } }));
    }
  };

  const handleUpdate = async (update: AppUpdate) => {
    setInstalling(update.id);
    try {
      const newInstalledApps = installedApps.map(app =>
        app.id === update.id
          ? { ...app, installedVersion: update.latestVersion, version: update.latestVersion }
          : app
      );
      setInstalledApps(newInstalledApps);
      saveInstalledApps(newInstalledApps);
      setUpdates(updates.filter(u => u.id !== update.id));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('zos:app-updated', { detail: { id: update.id } }));
      }
    } catch (err) {
      alert(`Failed to update app`);
    } finally {
      setInstalling(null);
    }
  };

  const isInstalled = (id: string) => installedApps.some(a => a.id === id);

  const filteredApps = availableApps.filter(app =>
    app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categoryColors: Record<string, string> = {
    productivity: 'from-blue-500 to-indigo-600',
    utilities: 'from-green-500 to-teal-600',
    entertainment: 'from-pink-500 to-rose-600',
    developer: 'from-orange-500 to-amber-600',
    system: 'from-gray-500 to-slate-600',
  };

  return (
    <div className={`flex flex-col h-full bg-[#1c1c1c] text-white ${className || ''}`}>
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">App Store</h1>
          <button
            onClick={loadData}
            className="text-blue-400 hover:text-blue-300 transition-colors"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search apps..."
          className="w-full px-4 py-2 bg-gray-800 rounded-lg text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Tabs */}
        <div className="flex gap-4 mt-4">
          {(['discover', 'installed', 'updates'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg capitalize transition-colors ${
                activeTab === tab
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tab}
              {tab === 'updates' && updates.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-500 rounded-full text-xs">
                  {updates.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-400">Loading apps from github.com/{GITHUB_ORG}...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={loadData}
                className="px-4 py-2 bg-blue-500 rounded-lg hover:bg-blue-400"
              >
                Retry
              </button>
            </div>
          </div>
        ) : activeTab === 'discover' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredApps.map(app => (
              <div
                key={app.id}
                className="bg-gray-800/50 rounded-xl p-4 hover:bg-gray-800 transition-colors border border-gray-700/50"
              >
                <div className="flex items-start gap-4">
                  {/* App Icon */}
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${categoryColors[app.category] || categoryColors.utilities} flex items-center justify-center text-3xl shadow-lg`}>
                    {app.icon}
                  </div>

                  {/* App Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{app.name}</h3>
                      <span className="text-xs text-gray-500">v{app.version}</span>
                    </div>
                    <p className="text-gray-400 text-sm line-clamp-2 mt-1">
                      {app.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-400 capitalize">
                        {app.category}
                      </span>
                      <span className="text-xs text-gray-500">{app.author}</span>
                    </div>
                  </div>

                  {/* Install Button */}
                  <button
                    onClick={() => isInstalled(app.id) ? handleUninstall(app.id) : handleInstall(app)}
                    disabled={installing === app.id}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                      installing === app.id
                        ? 'bg-gray-600 text-gray-400 cursor-wait'
                        : isInstalled(app.id)
                        ? 'bg-gray-600 text-gray-300 hover:bg-red-600 hover:text-white'
                        : 'bg-blue-500 text-white hover:bg-blue-400'
                    }`}
                  >
                    {installing === app.id ? '...' : isInstalled(app.id) ? 'Installed' : 'Get'}
                  </button>
                </div>

                {/* Permissions */}
                {app.permissions && app.permissions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-gray-700/50">
                    {app.permissions.map(perm => (
                      <span key={perm} className="px-2 py-0.5 bg-yellow-900/30 rounded text-xs text-yellow-400">
                        {perm}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {filteredApps.length === 0 && !loading && (
              <div className="col-span-2 text-center text-gray-400 py-12">
                <p className="text-4xl mb-4">🔍</p>
                <p>No apps found matching "{searchQuery}"</p>
              </div>
            )}
          </div>
        ) : activeTab === 'installed' ? (
          <div className="space-y-3">
            {installedApps.length === 0 ? (
              <div className="text-center text-gray-400 py-12">
                <p className="text-4xl mb-4">📱</p>
                <p>No apps installed yet.</p>
                <p className="text-sm mt-2">Browse the Discover tab to find apps.</p>
              </div>
            ) : (
              installedApps.map(app => (
                <div
                  key={app.id}
                  className="bg-gray-800/50 rounded-xl p-4 flex items-center gap-4 border border-gray-700/50"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${categoryColors[app.category] || categoryColors.utilities} flex items-center justify-center text-2xl`}>
                    {app.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">{app.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>v{app.installedVersion}</span>
                      <span>•</span>
                      <span className="capitalize">{app.source}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUninstall(app.id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Uninstall
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {updates.length === 0 ? (
              <div className="text-center text-gray-400 py-12">
                <p className="text-4xl mb-4">✅</p>
                <p>All apps are up to date!</p>
              </div>
            ) : (
              updates.map(update => {
                const app = installedApps.find(a => a.id === update.id);
                if (!app) return null;

                return (
                  <div
                    key={update.id}
                    className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${categoryColors[app.category] || categoryColors.utilities} flex items-center justify-center text-2xl`}>
                        {app.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">{app.name}</h3>
                        <p className="text-sm text-gray-500">
                          v{update.currentVersion} → v{update.latestVersion}
                        </p>
                      </div>
                      <button
                        onClick={() => handleUpdate(update)}
                        disabled={installing === update.id}
                        className="px-4 py-1.5 bg-blue-500 text-white rounded-full text-sm font-medium hover:bg-blue-400 disabled:bg-gray-600"
                      >
                        {installing === update.id ? 'Updating...' : 'Update'}
                      </button>
                    </div>
                    {update.releaseNotes && (
                      <div className="mt-3 pt-3 border-t border-gray-700/50">
                        <p className="text-xs text-gray-500 mb-1">What's New:</p>
                        <p className="text-sm text-gray-400 line-clamp-3">
                          {update.releaseNotes}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 p-3 border-t border-gray-700 text-center text-xs text-gray-500">
        Apps from{' '}
        <a
          href={`https://github.com/${GITHUB_ORG}`}
          className="text-blue-400 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          github.com/{GITHUB_ORG}
        </a>
        {' '}• {availableApps.length} available • {installedApps.length} installed
      </div>
    </div>
  );
};

export default ZAppStore;
