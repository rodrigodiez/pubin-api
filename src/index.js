import koa from "koa";
import bodyParser from "koa-bodyparser";
import { Client } from "@elastic/elasticsearch";

const app = new koa();
const listenerPort = process.env.KOA_PORT || 8080;
const esCluster = process.env.ES_CLUSTER || "http://localhost:9200";
const esIndex = process.env.ES_INDEX || "nodes";

const esClient = new Client({
  node: esCluster,
  auth: {
    username: process.env.ES_ACCESS_KEY,
    password: process.env.ES_ACCESS_SECRET,
  },
});

app.use(bodyParser());

app.use(async (ctx) => {
  const reqData = ctx.request.body.data;

  if (!reqData) {
    ctx.throw(400);
  }

  try {
    const res = await esClient.search({
      index: esIndex,
      size: 500,
      body: {
        query: {
          bool: {
            must: {
              terms: {
                "tags.tourism.keyword": ["hotel", "guest_house", "hostel"],
              },
            },
            filter: {
              geo_bounding_box: {
                location: {
                  top_left: {
                    lat: reqData.north_west.lat,
                    lon: reqData.north_west.lon,
                  },
                  bottom_right: {
                    lat: reqData.south_east.lat,
                    lon: reqData.south_east.lon,
                  },
                },
              },
            },
          },
        },
      },
    });

    const results = res.body.hits.hits.map((r) => {
      const [lat, lon] = r._source.location.split(", ");
      return { id: r._id, lat: lat, lon: lon, tags: r._source.tags };
    });

    ctx.body = {
      data: results,
    };
  } catch (e) {
    console.log(e);
    ctx.throw(500);
  }
});

app.listen(listenerPort, () => {
  console.log(`Listening for connections on ${listenerPort}`);
});
