/** Opens a URL in the default browser. Failing to open is fine: the URL is printed too. */
export function openBrowser(url: string): void {
  const command =
    process.platform === 'darwin'
      ? ['open', url]
      : process.platform === 'win32'
        ? ['cmd', '/c', 'start', '""', url]
        : ['xdg-open', url];
  try {
    Bun.spawn(command, { stdio: ['ignore', 'ignore', 'ignore'] }).unref();
  } catch {
    // No opener on this system (a headless box, say). The URL is already on screen.
  }
}
