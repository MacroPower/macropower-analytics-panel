import React, { PureComponent } from 'react';
import { PanelProps } from '@grafana/data';
import { Button, JSONFormatter, ErrorWithStack } from '@grafana/ui';
import { getTemplateSrv } from '@grafana/runtime';
import { flatten } from 'flat';
import { v4 as uuidv4 } from 'uuid';
import { Options } from './module';
import { PLUGIN_NAME } from './constants';
import { Payload, FlatPayload, getPayload, TimeRange, EventType } from 'payload';
import { isNew, isValidUrl, throwOnBadResponse } from 'utils';

interface Props extends PanelProps<Options> {}

export class AnalyticsPanel extends PureComponent<Props> {
  state: {
    uuid: string;
    interval?: NodeJS.Timeout;
    intervalFrequency?: number;
    error?: Error;
  } = {
    uuid: '',
  };

  getPayloadOrFlatPayload = (uuid: string, eventType: EventType): Payload | FlatPayload => {
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

  sendPayload = (eventType: EventType) => {
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

  sendKeepAlive = () => {
    const { keepAliveAlways } = this.props.options.analyticsOptions;
    if (keepAliveAlways || window.document.hasFocus()) {
      this.sendPayload('keep-alive');
    }
  };

  setKeepAlive = () => {
    const prevInterval = this.state.interval;
    const { postKeepAlive, keepAliveInterval } = this.props.options.analyticsOptions;
    const intervalFrequencyMs = keepAliveInterval * 1000;
    const prevIntervalFrequency = this.state.intervalFrequency;

    console.log(prevIntervalFrequency, keepAliveInterval);

    if (!postKeepAlive && prevInterval !== undefined) {
      // Interval should be disabled.
      clearInterval(prevInterval);
      this.setState({ interval: undefined, intervalFrequency: undefined });
    } else if (postKeepAlive && prevInterval === undefined) {
      // Interval should be created.
      const interval = setInterval(this.sendKeepAlive, intervalFrequencyMs);
      this.setState({ interval, intervalFrequency: keepAliveInterval });
    } else if (prevIntervalFrequency && prevIntervalFrequency !== keepAliveInterval) {
      // There may be an interval, but the settings have changed.
      console.log('Edit the interval.');
      if (prevInterval !== undefined) {
        clearInterval(prevInterval);
      }
      const interval = setInterval(this.sendKeepAlive, intervalFrequencyMs);
      this.setState({ interval, intervalFrequency: keepAliveInterval });
    } // Else, there is an interval, and nothing has changed.
  };

  componentDidMount() {
    const { postStart } = this.props.options.analyticsOptions;

    if (postStart) {
      this.sendPayload('start');
    }

    this.setKeepAlive();
  }

  componentDidUpdate() {
    this.setKeepAlive();
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
