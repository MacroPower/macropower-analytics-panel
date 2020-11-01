import React, { PureComponent } from 'react';
import { contextSrv } from 'grafana/app/core/core';
import { User } from 'grafana/app/core/services/context_srv';
import { PanelProps, RawTimeRange } from '@grafana/data';
import { VariableModel, VariableType } from '@grafana/data/types/templateVars';
import { Button, JSONFormatter, ErrorWithStack } from '@grafana/ui';
import { getTemplateSrv, config } from '@grafana/runtime';
import { flatten } from 'flat';
import { v4 as uuidv4 } from 'uuid';
import { Options } from './module';
import { PLUGIN_NAME } from './constants';

interface Props extends PanelProps<Options> {}

function isValidUrl(str: string) {
  try {
    new URL(str);
  } catch (_) {
    return false;
  }

  return true;
}

function getDashboardUIDFromURL(pathname: string) {
  const path = pathname.split('/');
  if (path && path.length > 2) {
    return path[2];
  }
  return '';
}

function isNew(pathname: string) {
  return pathname == 'dashboard/new';
}

function unixFromMs(ms: number) {
  return Math.floor(ms / 1000);
}

function getDate() {
  return unixFromMs(new Date().getTime());
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
      label: v.label || '',
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
  licenseUrl: string;
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
  dashboardId: number;
  dashboardUid: string;
  dashboardName: string;
  folderName: string;
};

type TimeRange = {
  from: number;
  to: number;
  raw: RawTimeRange;
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

export class AnalyticsPanel extends PureComponent<Props> {
  state: {
    uuid: string;
    interval?: NodeJS.Timeout;
    error?: Error;
  } = {
    uuid: '',
  };

  getPayload = (uuid: string, eventType: eventType): Payload => {
    const time = getDate();

    const dashboardOption = this.props.options.analyticsOptions.dashboard;

    const templateSrv = getTemplateSrv();
    const templateVars = templateSrv.getVariables();
    const variables = getVariables(templateVars);
    const dashboardName = templateSrv.replace(dashboardOption);

    const location = window.location;

    const host: HostInfo = {
      hostname: location.hostname,
      port: location.port,
      protocol: location.protocol,
      buildInfo: config.buildInfo,
      licenseInfo: config.licenseInfo,
    };

    const path = location.pathname;

    const dashboard: DashboardInfo = {
      dashboardName: dashboardName,
      dashboardUid: isNew(path) ? '' : getDashboardUIDFromURL(path),
      dashboardId: 0, // TODO: Set dashboardId
      folderName: '', // TODO: Set folderName
    };

    const tr = this.props.timeRange;
    const timeRange: TimeRange = {
      from: tr.from.unix(),
      to: tr.to.unix(),
      raw: tr.raw,
    };

    const timeOrigin = unixFromMs(window.performance.timeOrigin);

    return {
      uuid: uuid,
      type: eventType,
      host: host,
      dashboard: dashboard,
      user: contextSrv.user,
      variables: variables,
      timeRange: timeRange,
      timeZone: this.props.timeZone,
      timeOrigin: timeOrigin,
      time: time,
    };
  };

  getPayloadOrFlatPayload = (uuid: string, eventType: eventType): Payload | any => {
    const payload = this.getPayload(uuid, eventType);
    if (this.props.options.analyticsOptions.flatten) {
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
        if (window.document.hasFocus()) {
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
