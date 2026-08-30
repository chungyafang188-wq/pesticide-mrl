const KEY = "pesticide-mrl-drive";

export type DriveSettings = {
  shareUrl: string;
  apiKey: string;
};

export function loadDriveSettings(): DriveSettings {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as DriveSettings) : null;
    const envId = import.meta.env.VITE_DRIVE_FILE_ID ?? "";
    const envKey = import.meta.env.VITE_DRIVE_API_KEY ?? "";
    return {
      shareUrl: parsed?.shareUrl ?? envId,
      apiKey: parsed?.apiKey ?? envKey,
    };
  } catch {
    return {
      shareUrl: import.meta.env.VITE_DRIVE_FILE_ID ?? "",
      apiKey: import.meta.env.VITE_DRIVE_API_KEY ?? "",
    };
  }
}

export function saveDriveSettings(settings: DriveSettings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}
