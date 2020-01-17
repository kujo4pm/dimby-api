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
const defaultHeaders = {
  "Access-Control-Allow-Origin": process.env.FRONT_END_URL || "*",
  "Content-Type": "application/json"
};

const cannedResponses = {
  NOT_FOUND: apiKey => ({
    statusCode: 404,
    body: `ApiKey ${apiKey || ""} Not Valid`
  })
};
const fetchers = {
  [apis.ADDRESS_SEARCH]: {
    fetcher: async fetchObj => {
      const BASE_URL = "https://nominatim.openstreetmap.org/";
      const { limit = 3, q, polygonGeojson = 0 } = fetchObj;
      const response = await axios({
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
      return JSON.stringify(response.data);
    }
  },
  [apis.OPEN_STREET_VIEW]: {
    fetcher: async fetchObj => {
      const BASE_URL = "https://maps.googleapis.com/maps/api/streetview";
      const { OPEN_STREET_VIEW_KEY } = process.env;
      const { address } = fetchObj;
      console.log(
        "fetching image for:",
        address,
        ` at ${BASE_URL}?location=${address}&size=400x150&key=${OPEN_STREET_VIEW_KEY}`
      );
      const response = await axios(
        `${BASE_URL}?location=${address}&size=400x150&key=${OPEN_STREET_VIEW_KEY}`,
        {
          responseType: "arraybuffer"
        }
      );
      return `data:${response.headers["content-type"]};base64,${Buffer.from(
        String.fromCharCode(...new Uint8Array(response.data)),
        "binary"
      ).toString("base64")}`;
    },
    headers: () => ({
      "Content-Type": "image/jpeg"
    }),
    isBase64Encoded: true
  },
  [apis.OPEN_PLANNING]: {
    fetcher: async ({
      bottom_left_lat: bottomLeftLat,
      bottom_left_lng: bottomLeftLong,
      top_right_lat: topRightLat,
      top_right_lng: topRightLong,
      ...otherArguments
    }) => {
      const { OPEN_PLANNING_API_TOKEN } = process.env;
      const BASE_URL = "https://api.planningalerts.org.au/applications.js";
      const response = await axios({
        method: "get",
        url: BASE_URL,
        params: {
          key: OPEN_PLANNING_API_TOKEN,
          bottom_left_lat: bottomLeftLat,
          bottom_left_lng: bottomLeftLong,
          top_right_lat: topRightLat,
          top_right_lng: topRightLong,
          ...otherArguments
        }
      });
      return JSON.stringify(response.data);
    }
  }
};

/*
 * TODO: Put in some more serious authentication
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
    const {
      apiKey,
      auth_token: authTokenQueryString,
      ...otherQueryStringParams
    } = queryStringParameters || {};
    await authenticate(auth || authTokenQueryString);
    if (!apiKey || !Object.values(apis).includes(apiKey)) {
      return cannedResponses["NOT_FOUND"](apiKey);
    }

    const { headers = () => {}, fetcher, isBase64Encoded = false } = fetchers[
      apiKey
    ];

    const data = await fetcher(otherQueryStringParams);
    return {
      statusCode: 200,
      headers: {
        ...defaultHeaders,
        ...headers(data)
      },
      body: data,
      isBase64Encoded
    };
  } catch (err) {
    const { status = 500, message = "Error" } = err;
    console.error(err);
    return {
      statusCode: status,
      headers: defaultHeaders,
      body: JSON.stringify({
        message
      })
    };
  }
};
