export function isValidUrl(str: string) {
  try {
    new URL(str);
  } catch (_) {
    return false;
  }

  return true;
}

export function getDomainName(str: string) {
  return str.replace(/^.+\/\//g, '').replace(/\/.+$/g, '');
}

export function getDate() {
  return Math.floor(new Date().getTime() / 1000);
}

export function throwOnBadResponse(r: Response) {
  const status = r.status.toString();
  const regExp = /^(0)|(20[0-4])$/;

  if (!regExp.test(status)) {
    throw new Error(`Returned status ${status}`);
  }
  return r;
}
