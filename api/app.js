const axios = require('axios');
// const url = 'http://checkip.amazonaws.com/';
let response;

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html 
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 * 
 */

const apis = {
    ADDRESS_SEARCH: 'ADDRESS_SEARCH',
    OPEN_PLANNING: 'OPEN_PLANNING',
};


const fetchers = {
    [apis.ADDRESS_SEARCH]: {
        fetcher: fetchObj => {
            const BASE_URL = 'https://nominatim.openstreetmap.org/';
            const { limit = 3, q, polygonGeojson = 0 } = fetchObj;
            return axios({
                method: 'get',
                url: `${BASE_URL}search`,
                params: {
                    q,
                    format: 'json',
                    countrycodes: 'au', // limit to Australia
                    limit,
                    polygon_geojson: polygonGeojson
                }
            });
        },

    },
    [apis.OPEN_PLANNING]: {
        fetcher: ({ bottomLeft, topRight }) => {
            console.log(`fetching for ${(bottomLeft, topRight)} `);
            return axios({
                method: 'get',
                url: BASE_URL,
                params: {
                    key: OPEN_PLANNING_API_TOKEN,
                    bottom_left_lat: bottomLeft.lat,
                    bottom_left_lng: bottomLeft.lng,
                    top_right_lat: topRight.lat,
                    top_right_lng: topRight.lng
                }
            });
        }

    },
};
exports.lambdaHandler = async (event, context) => {
    console.log(event);
    try {
        // const ret = await axios(url);
        response = {
            'statusCode': 200,
            'body': JSON.stringify({
                message: 'hel1lo world',
            })
        }
    } catch (err) {
        console.log(err);
        return err;
    }

    return response
};
