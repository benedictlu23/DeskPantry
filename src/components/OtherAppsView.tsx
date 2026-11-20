import React, { useState } from 'react';
import { CheckCircle2, Download, ExternalLink, X } from 'lucide-react';
import { InternalApp } from '../types';
import { ProductImage } from './ProductImage';

interface OtherAppsViewProps {
  apps: InternalApp[];
  onToggleInstallApp: (appId: string) => void;
}

export const OtherAppsView: React.FC<OtherAppsViewProps> = ({
  apps,
  onToggleInstallApp,
}) => {
  const [launchedApp, setLaunchedApp] = useState<InternalApp | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
          Other Department Apps
        </h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          Newly built internal workplace tools ready to open or install alongside DeskPantry.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {apps.map((app) => (
          <article
            key={app.id}
            className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] overflow-hidden flex flex-col justify-between"
          >
            <div>
              <div className="aspect-[4/3] bg-stone-100 dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800">
                <ProductImage
                  src={app.image}
                  alt={app.name}
                  title={app.name}
                  className="w-full h-full object-cover"
                />
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
              </div>
            </div>

            <div className="px-5 pb-5 pt-2 flex items-center gap-2">
              {app.actionType === 'install' && !app.installed ? (
                <button
                  type="button"
                  onClick={() => onToggleInstallApp(app.id)}
                  className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Install App</span>
                </button>
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
        ))}
      </div>

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
    </div>
  );
};
