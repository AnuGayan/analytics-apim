/*
 *  Copyright (c) 2019, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 *  WSO2 Inc. licenses this file to you under the Apache License,
 *  Version 2.0 (the "License"); you may not use this file except
 *  in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing,
 *  software distributed under the License is distributed on an
 *  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 *  KIND, either express or implied.  See the License for the
 *  specific language governing permissions and limitations
 *  under the License.
 *
 */

import React from 'react';
import {
    defineMessages, IntlProvider, FormattedMessage, addLocaleData,
} from 'react-intl';
import Axios from 'axios';
import cloneDeep from 'lodash/cloneDeep';
import Moment from 'moment';
import { MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import Widget from '@wso2-dashboards/widget';
import APIMSignupsAnalytics from './APIMSignupsAnalytics';

const darkTheme = createMuiTheme({
    palette: {
        type: 'dark',
    },
    typography: {
        useNextVariants: true,
    },
});

const lightTheme = createMuiTheme({
    palette: {
        type: 'light',
    },
    typography: {
        useNextVariants: true,
    },
});

/**
 * Language
 * @type {string}
 */
const language = (navigator.languages && navigator.languages[0]) || navigator.language || navigator.userLanguage;

/**
 * Language without region code
 */
const languageWithoutRegionCode = language.toLowerCase().split(/[_-]+/)[0];

/**
 * Create React Component for APIM Signups Analytics
 * @class APIMSignupsAnalyticsWidget
 * @extends {Widget}
 */
class APIMSignupsAnalyticsWidget extends Widget {
    /**
     * Creates an instance of APIMSignupsAnalyticsWidget.
     * @param {any} props @inheritDoc
     * @memberof APIMSignupsAnalyticsWidget
     */
    constructor(props) {
        super(props);

        this.styles = {
            paper: {
                padding: '5%',
                border: '2px solid #4555BB',
            },
            paperWrapper: {
                margin: 'auto',
                width: '50%',
                marginTop: '20%',
            },
        };

        this.state = {
            width: this.props.width,
            height: this.props.height,
            timeTo: null,
            timeFrom: null,
            chartData: null,
            tableData: null,
            xAxisTicks: null,
            maxCount: 0,
            localeMessages: null,
            inProgress: true,
        };

        // This will re-size the widget when the glContainer's width is changed.
        if (this.props.glContainer !== undefined) {
            this.props.glContainer.on('resize', () => this.setState({
                width: this.props.glContainer.width,
                height: this.props.glContainer.height,
            }));
        }

        this.handlePublisherParameters = this.handlePublisherParameters.bind(this);
        this.assembleQuery = this.assembleQuery.bind(this);
        this.handleDataReceived = this.handleDataReceived.bind(this);
    }

    componentWillMount() {
        const locale = (languageWithoutRegionCode || language || 'en');
        this.loadLocale(locale).catch(() => {
            this.loadLocale().catch(() => {
                // TODO: Show error message.
            });
        });
    }

    componentDidMount() {
        const { widgetID } = this.props;

        super.getWidgetConfiguration(widgetID)
            .then((message) => {
                this.setState({
                    providerConfig: message.data.configs.providerConfig,
                }, () => super.subscribe(this.handlePublisherParameters));
            })
            .catch((error) => {
                console.error("Error occurred when loading widget '" + widgetID + "'. " + error);
                this.setState({
                    faultyProviderConfig: true,
                });
            });
    }

    componentWillUnmount() {
        const { id } = this.props;
        super.getWidgetChannelManager().unsubscribeWidget(id);
    }

    /**
     * Load locale file.
     * @param {string} locale Locale name
     * @memberof APIMSignupsAnalyticsWidget
     */
    loadLocale(locale = 'en') {
        return new Promise((resolve, reject) => {
            Axios
                .get(`${window.contextPath}/public/extensions/widgets/APIMSignupsAnalytics/locales/${locale}.json`)
                .then((response) => {
                    // eslint-disable-next-line global-require, import/no-dynamic-require
                    addLocaleData(require(`react-intl/locale-data/${locale}`));
                    this.setState({ localeMessages: defineMessages(response.data) });
                    resolve();
                })
                .catch(error => reject(error));
        });
    }

    /**
     * Retrieve params from publisher - DateTimeRange
     * @memberof APIMSignupsAnalyticsWidget
     * */
    handlePublisherParameters(receivedMsg) {
        const queryParam = super.getGlobalState('dtrp');
        const { sync } = queryParam;

        this.setState({
            timeFrom: receivedMsg.from,
            timeTo: receivedMsg.to,
            inProgress: !sync,
        }, this.assembleQuery);
    }

    /**
     * Formats the siddhi query using selected options
     * @memberof APIMSignupsAnalyticsWidget
     * */
    assembleQuery() {
        const { providerConfig, timeFrom, timeTo } = this.state;
        const { id, widgetID: widgetName } = this.props;

        const dataProviderConfigs = cloneDeep(providerConfig);
        dataProviderConfigs.configs.config.queryData.queryName = 'query';
        dataProviderConfigs.configs.config.queryData.queryValues = {
            '{{timeFrom}}': Moment(timeFrom).format('YYYY-MM-DD HH:mm:ss'),
            '{{timeTo}}': Moment(timeTo).format('YYYY-MM-DD HH:mm:ss'),
        };
        super.getWidgetChannelManager()
            .subscribeWidget(id, widgetName, this.handleDataReceived, dataProviderConfigs);
    }

    /**
     * Formats data retrieved and loads to the widget
     * @param {object} message - data retrieved
     * @memberof APIMSignupsAnalyticsWidget
     * */
    handleDataReceived(message) {
        const { data } = message;

        if (data && data.length > 0) {
            const xAxisTicks = [];
            const chartData = [];
            const tableData = [];
            let signups = 0;

            data.forEach((dataUnit) => {
                signups += dataUnit[2];
                chartData.push({
                    x: new Date(dataUnit[1]).getTime(),
                    y: signups,
                    label: 'CREATED_TIME:' + Moment(dataUnit[1]).format('YYYY-MMM-DD HH:mm:ss')
                        + '\nCOUNT:' + signups,
                });
                tableData.push({
                    developer: dataUnit[0],
                    signeduptime: Moment(dataUnit[1]).format('YYYY-MMM-DD HH:mm:ss'),
                });
            });

            const maxCount = chartData[chartData.length - 1].y;

            const first = new Date(chartData[0].x).getTime();
            const last = new Date(chartData[chartData.length - 1].x).getTime();
            const interval = (last - first) / 10;
            let duration = 0;
            xAxisTicks.push(first);
            for (let i = 1; i <= 10; i++) {
                duration = interval * i;
                xAxisTicks.push(new Date(first + duration).getTime());
            }

            this.setState({
                chartData, tableData, xAxisTicks, maxCount, inProgress: false,
            });
        } else {
            this.setState({ inProgress: false, chartData: [], tableData: [] });
        }
    }

    /**
     * @inheritDoc
     * @returns {ReactElement} Render the APIM Signups Analytics widget
     * @memberof APIMSignupsAnalyticsWidget
     */
    render() {
        const {
            localeMessages, faultyProviderConfig, height, chartData, tableData, xAxisTicks, maxCount, inProgress,
        } = this.state;
        const {
            paper, paperWrapper,
        } = this.styles;
        const { muiTheme } = this.props;
        const themeName = muiTheme.name;
        const signupsProps = {
            themeName, height, chartData, tableData, xAxisTicks, maxCount, inProgress,
        };

        return (
            <IntlProvider locale={language} messages={localeMessages}>
                <MuiThemeProvider theme={themeName === 'dark' ? darkTheme : lightTheme}>
                    {
                        faultyProviderConfig ? (
                            <div style={paperWrapper}>
                                <Paper elevation={1} style={paper}>
                                    <Typography variant='h5' component='h3'>
                                        <FormattedMessage
                                            id='config.error.heading'
                                            defaultMessage='Configuration Error !'
                                        />
                                    </Typography>
                                    <Typography component='p'>
                                        <FormattedMessage
                                            id='config.error.body'
                                            defaultMessage={'Cannot fetch provider configuration for APIM '
                                            + 'Signups Analytics widget'}
                                        />
                                    </Typography>
                                </Paper>
                            </div>
                        ) : (
                            <APIMSignupsAnalytics {...signupsProps} />
                        )
                    }
                </MuiThemeProvider>
            </IntlProvider>
        );
    }
}

global.dashboard.registerWidget('APIMSignupsAnalytics', APIMSignupsAnalyticsWidget);
