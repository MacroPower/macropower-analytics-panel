import React, { PureComponent } from 'react';
import { PanelProps } from '@grafana/data';
import { Button, JSONFormatter, ErrorWithStack } from '@grafana/ui';
import { flatten } from 'flat';
import { v4 as uuidv4 } from 'uuid';
import { Options } from './module';
import { PLUGIN_NAME } from './constants';
import { Payload, FlatPayload, getPayload, TimeRange, EventType, TemplateVariable } from 'payload';
import { getVars, isNew, isValidUrl, throwOnBadResponse } from 'utils';

interface Props extends PanelProps<Options> {}

export class AnalyticsPanel extends PureComponent<Props> {
  state: {
    uuid: string;
    interval?: NodeJS.Timeout;
    intervalFrequency?: number;
    server: string;
    dashboardName: string;
    variables: TemplateVariable[];
    location: Location;
    error?: Error;
  } = {
    uuid: '',
    location: JSON.parse(JSON.stringify(window.location)),
    ...getVars(this.props.options.analyticsOptions),
  };

  getPayloadOrFlatPayload = (uuid: string, eventType: EventType): Payload | FlatPayload => {
    const options = this.props.options.analyticsOptions;

    const tr = this.props.timeRange;
    const timeRange: TimeRange = {
      from: tr.from.unix(),
      to: tr.to.unix(),
      raw: tr.raw,
    };

    const payload = getPayload(
      uuid,
      eventType,
      options,
      timeRange,
      this.props.timeZone,
      this.state.dashboardName,
      this.state.location,
      this.state.variables
    );
    if (options.flatten) {
      return flatten(payload);
    }
    return payload;
  };

  sendPayload = (eventType: EventType) => {
    this.setState({ error: undefined });

    let uuid = '';
    if (eventType === 'start') {
      uuid = uuidv4();
      this.setState({ uuid });
    } else {
      uuid = this.state.uuid;
    }

    const { server, location } = this.state;

    if (isNew(location.pathname)) {
      const error = new Error('Dashboard is new and unsaved, and thus no ID was found.');
      this.setState({ error });
    } else if (!isValidUrl(server, location.origin)) {
      const error = new Error(`"${server}" is not a valid URL.`);
      this.setState({ error });
    } else {
      fetch(server, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(this.getPayloadOrFlatPayload(uuid, eventType)),
        headers: {
          'Content-Type': 'application/json',
        },
        keepalive: true,
      })
        .then((r) => throwOnBadResponse(r))
        .catch((e: Error) => {
          this.setState({ error: e });
        });
    }
  };

  sendHeartbeat = () => {
    const { heartbeatAlways } = this.props.options.analyticsOptions;
    if (heartbeatAlways || window.document.hasFocus()) {
      this.sendPayload('heartbeat');
    }
  };

  shouldSetVars = (server: string, dashboardName: string, variables: TemplateVariable[]) => {
    if (
      server !== this.state.server ||
      dashboardName !== this.state.dashboardName ||
      JSON.stringify(variables) !== JSON.stringify(this.state.variables)
    ) {
      return true;
    }

    return false;
  };

  setHeartbeat = () => {
    const prevInterval = this.state.interval;
    const { postHeartbeat, heartbeatInterval } = this.props.options.analyticsOptions;
    const intervalFrequencyMs = heartbeatInterval * 1000;
    const prevIntervalFrequency = this.state.intervalFrequency;

    console.log(prevIntervalFrequency, heartbeatInterval);

    if (!postHeartbeat && prevInterval !== undefined) {
      // Interval should be disabled.
      console.log('Disable the interval.');
      clearInterval(prevInterval);
      this.setState({ interval: undefined, intervalFrequency: undefined });
    } else if (postHeartbeat && prevInterval === undefined) {
      // Interval should be created.
      console.log('Create the interval.');
      const interval = setInterval(this.sendHeartbeat, intervalFrequencyMs);
      this.setState({ interval, intervalFrequency: heartbeatInterval });
    } else if (prevIntervalFrequency && prevIntervalFrequency !== heartbeatInterval) {
      // There may be an interval, but the settings have changed.
      console.log('Edit the interval.');
      if (prevInterval !== undefined) {
        clearInterval(prevInterval);
      }
      const interval = setInterval(this.sendHeartbeat, intervalFrequencyMs);
      this.setState({ interval, intervalFrequency: heartbeatInterval });
    } // Else, there is an interval, and nothing has changed.
  };

  componentDidMount() {
    console.log('componentDidMount');
    const { postStart } = this.props.options.analyticsOptions;

    if (postStart) {
      this.sendPayload('start');
    }

    this.setHeartbeat();
  }

  componentDidUpdate() {
    console.log('componentDidUpdate');
    const vars = getVars(this.props.options.analyticsOptions);
    if (this.shouldSetVars(vars.server, vars.dashboardName, vars.variables)) {
      this.setState({ ...vars });
    }
    this.setHeartbeat();
  }

  componentWillUnmount() {
    console.log('componentWillUnmount');
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
    const { showDetails } = this.props.options.analyticsOptions;
    const { error, uuid } = this.state;

    if (error && !showDetails) {
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
        {showDetails && <JSONFormatter json={this.getPayloadOrFlatPayload(uuid, 'start')} />}
      </div>
    );
  }
}
