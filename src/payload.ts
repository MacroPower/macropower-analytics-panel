import { RawTimeRange, VariableModel, VariableType } from '@grafana/data';
import { getTemplateSrv, config } from '@grafana/runtime';
import { getTimestamp, getUidFromPath, unixFromMs } from 'utils';

export type TemplateVariable = {
  name: string;
  label: string | null;
  type: VariableType;
  multi: boolean;
  values: Array<string>;
};

export function getVariables(templateVars: VariableModel[]) {
  const variables: Array<TemplateVariable> = templateVars.map((v: VariableModel) => {
    // Note: any because VariableModel does not define current
    const untypedVariableModel: any = v;

    let multi = false;
    let value: Array<string> | string | null | undefined = untypedVariableModel?.current?.value;

    if (typeof value === 'string' && value !== '') {
      value = [value];
    } else if (!Array.isArray(value)) {
      value = [];
    } else {
      multi = true;
    }

    return {
      name: v.name,
      label: v.label ?? '',
      type: v.type,
      multi: multi,
      values: value,
    };
  });

  return variables;
}

export type EventType = 'start' | 'heartbeat' | 'end';

export type LicenseInfo = {
  hasLicense: boolean;
  expiry: number;
  stateInfo: string;
};

export type BuildInfo = {
  version: string;
  commit: string;
  env: string;
  edition: string;
};

export type HostInfo = {
  hostname: string;
  port: string;
  protocol: string;
  buildInfo: BuildInfo;
  licenseInfo: LicenseInfo;
};

export type DashboardInfo = {
  name: string;
  uid: string;
};

export type TimeRange = {
  from: number;
  to: number;
  raw: RawTimeRange;
};

export type User = {
  isSignedIn: boolean;
  id: number;
  login: string;
  email: string;
  name: string;
  lightTheme: boolean;
  orgCount: number;
  orgId: number;
  orgName: string;
  orgRole: string;
  isGrafanaAdmin: boolean;
  timezone: string;
  locale: string;
  hasEditPermissionInFolders: boolean;
};

export type Payload = {
  uuid: string;
  type: EventType;
  host: HostInfo;
  dashboard: DashboardInfo;
  user: User;
  variables: TemplateVariable[];
  timeRange: TimeRange;
  timeZone: string;
  timeOrigin: number;
  time: number;
};

export type FlatPayload = any;

export function getPayload(
  uuid: string,
  EventType: EventType,
  dashboardInput: string,
  timeRange: TimeRange,
  timeZone: string
): Payload {
  const time = getTimestamp();
  const templateSrv = getTemplateSrv();
  const location = window.location;

  const templateVars = templateSrv.getVariables();
  const variables = getVariables(templateVars);

  const configBuildInfo = config.buildInfo;
  const buildInfo: BuildInfo = {
    version: configBuildInfo.version ?? '',
    commit: configBuildInfo.commit ?? '',
    env: configBuildInfo.env ?? '',
    edition: configBuildInfo.edition ?? '',
  };

  const configLicenseInfo = config.licenseInfo;
  const licenseInfo: LicenseInfo = {
    hasLicense: configLicenseInfo.hasLicense ?? false,
    expiry: configLicenseInfo.expiry ?? 0,
    stateInfo: configLicenseInfo.stateInfo ?? '',
  };

  const host: HostInfo = {
    hostname: location.hostname,
    port: location.port,
    protocol: location.protocol,
    buildInfo: buildInfo,
    licenseInfo: licenseInfo,
  };

  const path = location.pathname;
  const dashboardName = templateSrv.replace(dashboardInput);
  const dashboard: DashboardInfo = {
    name: dashboardName,
    uid: getUidFromPath(path),
  };

  const timeOrigin = unixFromMs(window.performance.timeOrigin);

  const configUser: User = config.bootData.user;
  const user: User = {
    isSignedIn: configUser.isSignedIn ?? false,
    id: configUser.id ?? 0,
    login: configUser.login ?? '',
    email: configUser.email ?? '',
    name: configUser.name ?? '',
    lightTheme: configUser.lightTheme ?? false,
    orgCount: configUser.orgCount ?? 0,
    orgId: configUser.orgId ?? 0,
    orgName: configUser.orgName ?? '',
    orgRole: configUser.orgRole ?? '',
    isGrafanaAdmin: configUser.isGrafanaAdmin ?? false,
    timezone: configUser.timezone ?? '',
    locale: configUser.locale ?? '',
    hasEditPermissionInFolders: configUser.hasEditPermissionInFolders ?? false,
  };

  return {
    uuid: uuid,
    type: EventType,
    host: host,
    dashboard: dashboard,
    user: user,
    variables: variables,
    timeRange: timeRange,
    timeZone: timeZone,
    timeOrigin: timeOrigin,
    time: time,
  };
}
