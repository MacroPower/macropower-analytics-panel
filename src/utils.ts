export function isNew(pathname: string) {
  return pathname == 'dashboard/new';
}

export function getUidFromPath(pathname: string) {
  if (!isNew(pathname)) {
    const path = pathname.split('/');
    if (path && path.length > 2) {
      return path[2];
    }
  }
  return '';
}

export function unixFromMs(ms: number) {
  return Math.floor(ms / 1000);
}

export function getTimestamp() {
  return unixFromMs(new Date().getTime());
}

export function isValidUrl(str: string) {
  try {
    new URL(str);
  } catch (_) {
    return false;
  }

  return true;
}

export function throwOnBadResponse(r: Response) {
  const status = r.status.toString();
  const regExp = /^(0)|(20[0-4])$/;

  if (!regExp.test(status)) {
    throw new Error(`Returned status ${status}`);
  }
  return r;
}
