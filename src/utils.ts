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
