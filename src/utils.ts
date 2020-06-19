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

export function getDashboardName(str: string) {
  return str.replace(/^.+\/d\/.+\//g, '').replace(/\?.+$/g, '');
}

export function getDashboard(template: any) {
  const dashboardVars: { name: string; uid: string } = template.index.__dashboard.current.value;

  return {
    name: dashboardVars.name,
    uid: dashboardVars.uid,
  };
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
