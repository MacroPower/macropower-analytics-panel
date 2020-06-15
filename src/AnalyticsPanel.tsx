import React, { PureComponent } from 'react';
import { Props } from 'types';
import { contextSrv } from 'grafana/app/core/core';
import { isValidUrl, getDomainName, getDate, throwOnBadResponse } from './utils';
import { PLUGIN_NAME } from './constants';
import { flatten } from 'flat';
import { Button, JSONFormatter, ErrorWithStack } from '@grafana/ui';

export class AnalyticsPanel extends PureComponent<Props> {
  state: {
    update: string;
    error?: Error;
  } = {
    update: '',
  };

  body = (): any => {
    const tr = this.props.timeRange;
    const timeRange = { from: tr.from.unix(), to: tr.to.unix() };
    const host = getDomainName(window.location.href);
    const environment = { host, timeRange };

    const options = this.props.options.analyticsOptions;
    const context = contextSrv.user;
    const time = getDate();

    const result = { options, environment, context, time };

    if (options.flatten) {
      return flatten(result);
    }
    return result;
  };

  getRequestInit = (): RequestInit => {
    const { noCors } = this.props.options.analyticsOptions;

    this.setState({ error: undefined });

    return {
      method: 'POST',
      mode: noCors ? 'no-cors' : 'cors',
      body: JSON.stringify(this.body()),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  };

  sendInitPayload = () => {
    const { server, postEnd } = this.props.options.analyticsOptions;

    if (isValidUrl(server)) {
      const req = fetch(server, this.getRequestInit());

      if (postEnd) {
        req
          .then(r => throwOnBadResponse(r))
          .then(r => r.json())
          .then(r => this.setState({ update: r.location }))
          .catch((e: Error) => {
            this.setState({ error: e });
          });
      } else {
        req
          .then(r => throwOnBadResponse(r))
          .catch((e: Error) => {
            this.setState({ error: e });
          });
      }
    } else {
      const error = new Error(`"${server}" is not a valid URL`);
      this.setState({ error });
    }
  };

  sendFinPayload = () => {
    const { server, postEnd } = this.props.options.analyticsOptions;
    const { update } = this.state;

    if (postEnd && update) {
      const url = server + '/' + update;
      fetch(url, this.getRequestInit())
        .then(r => throwOnBadResponse(r))
        .catch((e: Error) => {
          const error = `${PLUGIN_NAME} final payload error : ${e.name} : ${e.message}`;
          console.log(error);
        });
    }
  };

  componentDidMount() {
    this.sendInitPayload();
  }

  componentWillUnmount() {
    this.sendFinPayload();
  }

  render() {
    const { width, height } = this.props;
    const { analyticsOptions } = this.props.options;
    const { error } = this.state;

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
            <Button onClick={() => this.sendInitPayload()}>Retry</Button>
          </div>
        )}
        {!analyticsOptions.hidden && <JSONFormatter json={this.body()} />}
      </div>
    );
  }
}
