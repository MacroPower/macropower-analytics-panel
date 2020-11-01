import React, { PureComponent } from 'react';
import { PanelProps, RawTimeRange } from '@grafana/data';
import { VariableModel, VariableType } from '@grafana/data/types/templateVars';
import { Button, JSONFormatter, ErrorWithStack } from '@grafana/ui';
import { getTemplateSrv, config } from '@grafana/runtime';
import { flatten } from 'flat';
import { v4 as uuidv4 } from 'uuid';
import { Options } from './module';
import { PLUGIN_NAME } from './constants';

interface Props extends PanelProps<Options> {}

function isNew(pathname: string) {
  return pathname == 'dashboard/new';
}

function getUidFromPath(pathname: string) {
  if (!isNew(pathname)) {
    const path = pathname.split('/');
    if (path && path.length > 2) {
      return path[2];
    }
  }
  return '';
}

function unixFromMs(ms: number) {
  return Math.floor(ms / 1000);
}

function getTimestamp() {
  return unixFromMs(new Date().getTime());
}

function isValidUrl(str: string) {
  try {
    new URL(str);
  } catch (_) {
    return false;
  }

  return true;
}

function throwOnBadResponse(r: Response) {
  const status = r.status.toString();
  const regExp = /^(0)|(20[0-4])$/;

  if (!regExp.test(status)) {
    throw new Error(`Returned status ${status}`);
  }
  return r;
}

type TemplateVariable = {
  name: string;
  label: string | null;
  type: VariableType;
  multi: boolean;
  values: Array<string>;
};

function getVariables(templateVars: VariableModel[]) {
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

type eventType = 'start' | 'keep-alive' | 'end';

type LicenseInfo = {
  hasLicense: boolean;
  expiry: number;
  stateInfo: string;
};

type BuildInfo = {
  version: string;
  commit: string;
  env: string;
  edition: string;
};

type HostInfo = {
  hostname: string;
  port: string;
  protocol: string;
  buildInfo: BuildInfo;
  licenseInfo: LicenseInfo;
};

type DashboardInfo = {
  name: string;
  uid: string;
};

type TimeRange = {
  from: number;
  to: number;
  raw: RawTimeRange;
};

type User = {
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

type Payload = {
  uuid: string;
  type: eventType;
  host: HostInfo;
  dashboard: DashboardInfo;
  user: User;
  variables: TemplateVariable[];
  timeRange: TimeRange;
  timeZone: string;
  timeOrigin: number;
  time: number;
};

type FlatPayload = any;

function getPayload(
  uuid: string,
  eventType: eventType,
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
    type: eventType,
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

export class AnalyticsPanel extends PureComponent<Props> {
  state: {
    uuid: string;
    interval?: NodeJS.Timeout;
    error?: Error;
  } = {
    uuid: '',
  };

  getPayloadOrFlatPayload = (uuid: string, eventType: eventType): Payload | FlatPayload => {
    const options = this.props.options.analyticsOptions;

    const tr = this.props.timeRange;
    const timeRange: TimeRange = {
      from: tr.from.unix(),
      to: tr.to.unix(),
      raw: tr.raw,
    };

    const payload = getPayload(uuid, eventType, options.dashboard, timeRange, this.props.timeZone);
    if (options.flatten) {
      return flatten(payload);
    }
    return payload;
  };

  sendPayload = (eventType: eventType) => {
    this.setState({ error: undefined });

    let uuid = '';
    if (eventType === 'start') {
      uuid = uuidv4();
      this.setState({ uuid });
    } else {
      uuid = this.state.uuid;
    }

    const { server } = this.props.options.analyticsOptions;
    const serverReplaced = getTemplateSrv().replace(server);

    if (isNew(window.location.pathname)) {
      const error = new Error('Dashboard is new and unsaved, and thus no ID was found.');
      this.setState({ error });
    } else if (!isValidUrl(serverReplaced)) {
      const error = new Error(`"${serverReplaced}" is not a valid URL.`);
      this.setState({ error });
    } else {
      fetch(serverReplaced, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(this.getPayloadOrFlatPayload(uuid, eventType)),
        headers: {
          'Content-Type': 'application/json',
        },
      })
        .then(r => throwOnBadResponse(r))
        .catch((e: Error) => {
          this.setState({ error: e });
        });
    }
  };

  componentDidMount() {
    const { postStart, postKeepAlive } = this.props.options.analyticsOptions;

    if (postStart) {
      this.sendPayload('start');
    }

    if (postKeepAlive) {
      const intervalFrequency = this.props.options.analyticsOptions.keepAliveInterval;
      const intervalFrequencyMs = intervalFrequency * 1000;
      const interval = setInterval(() => {
        const keepAliveAlways = this.props.options.analyticsOptions.keepAliveAlways;
        if (keepAliveAlways || window.document.hasFocus()) {
          this.sendPayload('keep-alive');
        }
      }, intervalFrequencyMs);
      this.setState({ interval });
    }
  }

  componentWillUnmount() {
    const { postEnd } = this.props.options.analyticsOptions;

    if (postEnd) {
      this.sendPayload('end');
    }

    const { interval } = this.state;

    if (interval !== undefined) {
      clearInterval(interval);
    }
  }

  render() {
    const { width, height } = this.props;
    const { hidden } = this.props.options.analyticsOptions;
    const { error, uuid } = this.state;

    if (error && hidden) {
      throw error;
    }

    return (
      <div
        style={{
          position: 'relative',
          overflow: 'auto',
          width,
          height,
        }}
      >
        {error && (
          <div
            style={{
              display: 'inline-block',
              textAlign: 'center',
              width: '100%',
            }}
          >
            <ErrorWithStack title={`${PLUGIN_NAME} error`} error={error} errorInfo={null} />
            <Button onClick={() => this.sendPayload('start')}>Retry</Button>
          </div>
        )}
        {!hidden && <JSONFormatter json={this.getPayloadOrFlatPayload(uuid, 'start')} />}
      </div>
    );
  }
}
