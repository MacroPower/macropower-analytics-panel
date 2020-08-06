import React, { PureComponent } from 'react';
import { Props } from 'types';
import { contextSrv } from 'grafana/app/core/core';
import { isValidUrl, getDomainName, getDate, throwOnBadResponse, getDashboard } from './utils';
import { PLUGIN_NAME } from './constants';
import { flatten } from 'flat';
import { Button, JSONFormatter, ErrorWithStack } from '@grafana/ui';
import { getTemplateSrv } from '@grafana/runtime';
import { VariableModel, VariableType } from '@grafana/data/types/templateVars';

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

    const url = window.location.href;
    const endpoint = getDomainName(url);

    const templateSrv = getTemplateSrv();
    const templateVars = templateSrv.getVariables();
    const dashboard = getDashboard(url);

    const variables: Array<{
      name: string;
      label: string | null;
      type: VariableType;
      value: string | null;
    }> = templateVars.map((v: VariableModel) => {
      // Note: any because VariableModel does not define current
      const untypedVariableModel: any = v;

      const value: string | undefined = untypedVariableModel?.current?.value;

      return {
        name: v.name,
        label: v.label,
        type: v.type,
        value: value || null,
      };
    });

    const host = { endpoint };

    const environment = { host, timeRange, dashboard };
    const options = this.props.options.analyticsOptions;
    const context = contextSrv.user;

    const time = getDate();

    if (options.flatten) {
      return flatten({ options, environment, context, time });
    }
    return { options, environment, context, variables, time };
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
      fetch(url, this.getRequestInit()).then(r => throwOnBadResponse(r));
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
    const { hidden } = this.props.options.analyticsOptions;
    const { error } = this.state;

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
            <Button onClick={() => this.sendInitPayload()}>Retry</Button>
          </div>
        )}
        {!hidden && <JSONFormatter json={this.body()} />}
      </div>
    );
  }
}
