const { connect } = require('workspace-integrations');
const express = require('express');
const app = express();

// Middleware setup, parse JSON bodies
app.use(express.json());

if (process.env.NODE_ENV !== 'production'){
    require('dotenv').config()
  }

  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const refreshToken = process.env.REFRESH_TOKEN;
  const appURl = process.env.APP_URL
  const deviceId = process.env.DEVICE_ID;
  const xApiKeyuse = process.env.X_API_KEY;
  const username = process.env.USERNAME;
  const password = process.env.PASSWORD;
  const itemId = process.env.ITEM_ID;
  const entity = process.env.ENTITY;

  let token = '';
  
/*************************************************************
 * Functions
**************************************************************/

const processSensorValues = async (integration) => {
  console.log ('Getting Sensors Values');
  const sensorData = await getSensorsValues(integration);
  
  console.log ('Sending information to external system: ', sensorData);
  const response = await sendInfoToExternalsystem(sensorData);
  console.log ('External System reponse:', response.ok);
}

const getSensorsValues = async (integration) => {
  let temperature = '';
  let airQuality = '';
  let ambientNoise = '';
  let humidity = 0;
  let soundLevel = 0;
  let presence = '';
  let peopleCount = 0;
  let capacity = 0;
  
  try {
    temperature = await integration.xapi.status.get(deviceId, 'RoomAnalytics.AmbientTemperature');
    // Macro style: temperature = await xapi.Status.RoomAnalytics.AmbientTemperature.get();
    humidity = await integration.xapi.status.get(deviceId, 'RoomAnalytics.RelativeHumidity');
    // Macro style humidity = await xapi.Status.RoomAnalytics.RelativeHumidity.get();
    soundLevel = await integration.xapi.status.get(deviceId, 'RoomAnalytics.Sound.Level.A');
    // Macro style soundLevel = await xapi.Status.RoomAnalytics.Sound.Level.A.get()
    presence = await integration.xapi.status.get(deviceId, 'RoomAnalytics.PeoplePresence');
    // Macro style presence = await xapi.Status.RoomAnalytics.PeoplePresence.get();
    peopleCount = await integration.xapi.status.get(deviceId, 'RoomAnalytics.PeopleCount.Current');
    // Macro style peopleCount = await xapi.Status.RoomAnalytics.PeopleCount.Current.get()
    capacity = await integration.xapi.status.get(deviceId, 'RoomAnalytics.PeopleCount.Capacity');
    // Macro style capacity = await xapi.Status.RoomAnalytics.PeopleCount.Capacity.get();
    // console.log ({temperature, humidity, soundLevel, presence, peopleCount, capacity});
    
    // Not supported on Desk Pro !!
    // https://help.webex.com/en-us/article/nc6od6r/Utilization-and-environmental-metrics-for-workspaces
    // airQuality = await xapi.Status.RoomAnalytics.AirQuality.Index.get();
    // console.log (airQuality);

    // This fails on Desk Pro
    // ambientNoise = await xapi.Status.RoomAnalytics.AmbientNoise.Level.A.get()
    // console (ambientNoise);
    return {
      temperature: temperature,
      humidity: humidity,
      airQuality: airQuality,
      soundLevel: soundLevel,
      ambientNoise: ambientNoise,
      presence: presence,
      peopleCount: peopleCount,
      capacity: capacity
    }
  }
  catch (error) {
    console.log ('Error getting info from sensors:', error);
  }
}

const sendInfoToExternalsystem = async (sensorData) => {
  const authUrl = process.env.AUTH_URL;
  const metricsUrl= process.env.METRICS_URL;

  let body = {
    username: username,
    password: password
  };
  let options = {
    method: 'POST',
    headers: {
      'x-api-key': xApiKeyuse,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  };

  // Get Workspace solution Access Token. Tokens are valid for 1h, and we are sending the info every 5m
  try {
    let response = await fetch(authUrl, options);
    if (!response.ok) {
      console.error(`Auth failed with status ${response.status}: ${response.statusText}`);
      throw new Error(`Auth failed with status ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    token = data.AuthenticationResult.AccessToken;
    console.log ('Workspace Solution Access Token created');
    // At this point we have a good Access Token
    
    // Prepare sensor data to be sent
    let metrics = [
      {
        "Label": "Temperature",
        "Unit": "°C",
        "Value": sensorData.temperature
      },
      {
        "Label": "Humidity",
        "Unit": "%",
        "Value": sensorData.humidity
      },
      {
        "Label": "Air quality",
        "Unit": "ppm",
        "Value": sensorData.airQuality
      },
      {
        "Label": "Sound Level",
        "Unit": "dB",
        "Value": sensorData.soundLevel
      },
      {
        "Label": "Room busy",
        "Unit": "Yes/No",
        "Value": sensorData.presence
      },
      {
        "Label": "People in the Room",
        "Unit": "persons",
        "Value": sensorData.peopleCount
      },
      {
        "Label": "Room MAx Capacity",
        "Unit": "persons",
        "Value": sensorData.capacity
      }
    ]    
    body = {
      "ID": itemId,
      "Entity": entity,
      "Metrics": metrics
    }
    options = {
      method: 'POST',
      headers: {
        'x-api-key': xApiKeyuse,
        'content-type': 'application/json',
        'authorization': token
      },
      body: JSON.stringify(body)
    };
    try {
      response = await fetch(metricsUrl, options);
      if (!response.ok) {
        console.error(`Sending sensor data failed with status ${response.status}: ${response.statusText}`);
        throw new Error(`Sending sensor data failed with status ${response.status}: ${response.statusText}`);
      }
      return response;
    }
    catch (error) {
      console.error("Error sending Data to metrics API")
      return
    }
    
  }
  catch (error) {
    console.error("Authentication Error:", error);
    return
  }
}

/*************************************************************
 * Main code
**************************************************************/

const main = async () => {
    // Init integration
    const config = {
      clientId: clientId,
      clientSecret: clientSecret,
      activationCode: {
          oauthUrl: "https://webexapis.com/v1/access_token",
          refreshToken: refreshToken,
          webexapisBaseUrl: "https://webexapis.com/v1",
          appUrl: appURl
      },
      notifications: 'longpolling',
      logLevel: 'info'
  };
  const integration = await connect(config).catch(e => {
      console.error(e)
      return
  });
  
  // This is not used, just one example of how to get the value instead of suscribe to the event
  const value = await integration.xapi.status.get(deviceId, 'RoomAnalytics.PeoplePresence').catch(e => {
      console.error(e)
      return
  });
  console.log ('People Presence:', value);

  // Listener for people presence change
  integration.xapi.status.on('RoomAnalytics.PeoplePresence', (deviceId, path, value, data) => {
      // Macro syntax: xapi.Status.RoomAnalytics.PeoplePresence.on(peoplePresenceChange)
      console.log ('-------------------------> Change in People Presence');   
      if (value == 'Yes') {
      console.log (`Room with Device: ${deviceId} is occupied`);
      }
      else {
      console.log (`Room with Device: ${deviceId} is free`);
      }
  }); 

  // Get Sensor Details every X minutes and send them to the External System
  const FIVE_MINUTES = 5 * 60  * 1000;
  processSensorValues(integration); // Execute immediately on startup
  setInterval(() => processSensorValues(integration), FIVE_MINUTES);
};


// Webhook listening to CH Alerts
app.post('/webhook', async (req, res) => {
  console.log ('Webhook triggered');
  const incidentsUrl = process.env.INCIDENTS_URL;
  let body = {
    "category": "161",
    "impact": "3",
    "urgency": "2",
    "description": "Cisco Video Device Alert",
    "latitude": 38.806965,
    "longitude": -9.437355,
    "reporting_method": "UnifiedSynergy",
    "correlation_id": itemId,
    "federation_entity": entity,
    "short_description": "Synergy Test"
  };
  let options = {
    method: 'POST',
    headers: {
      'x-api-key': xApiKeyuse,
      'content-type': 'application/json',
      'authorization': token
    },
    body: JSON.stringify(body)
  };

  try {
    response = await fetch(incidentsUrl, options);
    console.log ('last reponse -> \n', response);
    if (!response.ok) {
      console.error(`Sending alert failed with status ${response.status}: ${response.statusText}`);
      return res.status(500).json({ error: 'Failed sending incident' })
    }
    console.log('Incident sent successfully');
    return res.status(200).json({ message: 'Incident sent' });
  }
  catch (error) {
    console.error("Error sending alert, internal server error");
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(3000, () => {
  console.log('Webhook server listening on port 3000 for alerts');
});

main();

