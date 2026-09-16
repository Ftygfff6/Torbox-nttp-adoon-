const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;
const TORBOX_API_KEY = process.env.TORBOX_API_KEY;
const TORBOX_API_BASE =
  process.env.TORBOX_API_BASE || "https://api.torbox.app/v1";

if (!TORBOX_API_KEY) {
  console.warn("⚠️ TORBOX_API_KEY is not configured");
}

/* -------------------------
   Helpers
------------------------- */

function torboxHeaders() {
  return {
    Authorization: `Bearer ${TORBOX_API_KEY}`,
    Accept: "application/json",
  };
}

function emptyStreams(res) {
  return res.json({ streams: [] });
}

/* -------------------------
   Home
------------------------- */

app.get("/", (req, res) => {
  res.json({
    name: "TorBox Usenet Stremio Addon",
    status: "online",
  });
});

/* -------------------------
   Health check
------------------------- */

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    torboxConfigured: Boolean(TORBOX_API_KEY),
  });
});

/* -------------------------
   Stremio Manifest
------------------------- */

app.get("/manifest.json", (req, res) => {
  res.json({
    id: "org.torbox.usenet.private",
    version: "1.0.0",
    name: "TorBox Usenet",
    description:
      "TorBox Usenet addon for authorized/personal media",
    resources: [
      {
        name: "stream",
        types: ["movie", "series"],
        idPrefixes: ["tb:"]
      }
    ],
    types: ["movie", "series"],
    idPrefixes: ["tb:"],
    catalogs: []
  });
});

/* =========================================================
   CREATE USENET DOWNLOAD

   POST /api/usenet/add

   Body:
   {
     "nzbUrl": "https://example.com/file.nzb",
     "name": "My File"
   }

   This is intended for NZB files/URLs you are authorized
   to access.
========================================================= */

app.post("/api/usenet/add", async (req, res) => {
  try {
    if (!TORBOX_API_KEY) {
      return res.status(500).json({
        error: "TORBOX_API_KEY is not configured"
      });
    }

    const { nzbUrl, name } = req.body;

    if (!nzbUrl) {
      return res.status(400).json({
        error: "nzbUrl is required"
      });
    }

    const body = {
      link: nzbUrl
    };

    if (name) {
      body.name = name;
    }

    const response = await axios.post(
      `${TORBOX_API_BASE}/api/usenet/createusenetdownload`,
      body,
      {
        headers: {
          ...torboxHeaders(),
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    res.json({
      ok: true,
      data: response.data
    });

  } catch (error) {
    console.error(
      "createusenetdownload:",
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      error: "TorBox Usenet creation failed",
      details: error.response?.data || error.message
    });
  }
});

/* =========================================================
   USENET LIST

   GET /api/usenet/list
========================================================= */

app.get("/api/usenet/list", async (req, res) => {
  try {
    if (!TORBOX_API_KEY) {
      return res.status(500).json({
        error: "TORBOX_API_KEY is not configured"
      });
    }

    const response = await axios.get(
      `${TORBOX_API_BASE}/api/usenet/mylist`,
      {
        headers: torboxHeaders(),
        params: {
          bypass_cache: "true"
        },
        timeout: 15000
      }
    );

    res.json(response.data);

  } catch (error) {
    console.error(
      "mylist:",
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      error: "Unable to get TorBox Usenet list",
      details: error.response?.data || error.message
    });
  }
});

/* =========================================================
   GET DOWNLOAD LINK

   GET /api/usenet/link/:usenetId/:fileId

   Redirects the browser/player to TorBox's CDN.
========================================================= */

app.get(
  "/api/usenet/link/:usenetId/:fileId",
  async (req, res) => {
    try {
      if (!TORBOX_API_KEY) {
        return res.status(500).send("TORBOX_API_KEY missing");
      }

      const { usenetId, fileId } = req.params;

      const response = await axios.get(
        `${TORBOX_API_BASE}/api/usenet/requestdl`,
        {
          headers: {
            Accept: "*/*"
          },
          params: {
            token: TORBOX_API_KEY,
            usenet_id: usenetId,
            file_id: fileId,
            redirect: "true"
          },
          maxRedirects: 0,
          validateStatus: status =>
            status >= 200 && status < 400,
          timeout: 15000
        }
      );

      const location =
        response.headers.location ||
        response.request?.res?.responseUrl;

      if (location) {
        return res.redirect(location);
      }

      if (response.data?.url) {
        return res.redirect(response.data.url);
      }

      return res.status(404).send("TorBox download link not ready");

    } catch (error) {
      console.error(
        "requestdl:",
        error.response?.data || error.message
      );

      res.status(error.response?.status || 500).send(
        "Unable to create TorBox download link"
      );
    }
  }
);

/* =========================================================
   STREMIO STREAM

   This route expects:

   /stream/movie/tb:USENET_ID:FILE_ID.json

   Example:

   /stream/movie/tb:12345:67890.json
========================================================= */

app.get(
  "/stream/:type/:id.json",
  async (req, res) => {
    try {
      if (!TORBOX_API_KEY) {
        return emptyStreams(res);
      }

      const { type, id } = req.params;

      if (!id.startsWith("tb:")) {
        return emptyStreams(res);
      }

      const parts = id.split(":");

      if (parts.length < 3) {
        return emptyStreams(res);
      }

      const usenetId = parts[1];
      const fileId = parts[2];

      if (!usenetId || !fileId) {
        return emptyStreams(res);
      }

      const streamUrl =
        `/api/usenet/link/${encodeURIComponent(
          usenetId
        )}/${encodeURIComponent(fileId)}`;

      res.json({
        streams: [
          {
            name: "TorBox Usenet",
            title:
              "TorBox Usenet\nAuthorized media",
            url: streamUrl,
            behaviorHints: {
              notWebReady: true
            }
          }
        ]
      });

    } catch (error) {
      console.error("stream:", error);
      return emptyStreams(res);
    }
  }
);

/* -------------------------
   404
------------------------- */

app.use((req, res) => {
  res.status(404).json({
    error: "Not found"
  });
});

/* -------------------------
   Start
------------------------- */

app.listen(PORT, () => {
  console.log(
    `🚀 TorBox Usenet addon running on port ${PORT}`
  );
});
