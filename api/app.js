require("dotenv").config();
const axios = require("axios");

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
  ADDRESS_SEARCH: "ADDRESS_SEARCH",
  OPEN_PLANNING: "OPEN_PLANNING",
  OPEN_STREET_VIEW: "OPEN_STREET_VIEW"
};

const cannedResponses = {
  NOT_FOUND: apiKey => ({
    statusCode: 404,
    body: `ApiKey ${apiKey || ""} Not Valid`
  })
};
const fetchers = {
  [apis.ADDRESS_SEARCH]: {
    fetcher: fetchObj => {
      const BASE_URL = "https://nominatim.openstreetmap.org/";
      const { limit = 3, q, polygonGeojson = 0 } = fetchObj;
      return axios({
        method: "get",
        url: `${BASE_URL}search`,
        params: {
          q,
          format: "json",
          countrycodes: "au", // limit to Australia
          limit,
          polygon_geojson: polygonGeojson
        }
      });
    }
  },
  [apis.OPEN_STREET_VIEW]: {
    fetcher: fetchObj => {
      const BASE_URL = "https://maps.googleapis.com/maps/api/streetview";
      const { OPEN_STREET_VIEW_KEY } = process.env;
      const { address } = fetchObj;

      console.log("fetching image for:", address);
      return axios(
        `${BASE_URL}?location=${address}&size=400x150&key=${OPEN_STREET_VIEW_KEY}`
      );
    }
  },
  [apis.OPEN_PLANNING]: {
    fetcher: ({ bottomLeftLat, bottomLeftLong, topRightLat, topRightLong }) => {
      const { OPEN_PLANNING_API_TOKEN } = process.env;
      const BASE_URL = "https://api.planningalerts.org.au/applications.js";
      return axios({
        method: "get",
        url: BASE_URL,
        params: {
          key: OPEN_PLANNING_API_TOKEN,
          bottom_left_lat: bottomLeftLat,
          bottom_left_lng: bottomLeftLong,
          top_right_lat: topRightLat,
          top_right_lng: topRightLong
        }
      });
    }
  }
};

/*
 * TODO: Put in some more serious JWT authentication
 */

const authenticate = auth => {
  const { CLIENT_TOKEN } = process.env;
  if (auth === CLIENT_TOKEN) {
    return Promise.resolve();
  }
  return Promise.reject({
    status: 403,
    message: "Forbidden Access"
  });
};
exports.lambdaHandler = async event => {
  const { headers, queryStringParameters = {} } = event;
  const { Authorization: auth } = headers;
  try {
    await authenticate(auth);
    const { apiKey, ...otherQueryStringParams } = queryStringParameters || {};
    if (!apiKey || !Object.values(apis).includes(apiKey)) {
      return cannedResponses["NOT_FOUND"](apiKey);
    }

    const response = await fetchers[apiKey].fetcher(otherQueryStringParams);
    console.log({ response });
    return {
      statusCode: 200,
      body: {
        data: JSON.stringify(response.data)
      }
    };
  } catch (err) {
    const { status = 500, message = "Error" } = err;
    return {
      statusCode: status,
      body: JSON.stringify({
        message
      })
    };
  }
};
