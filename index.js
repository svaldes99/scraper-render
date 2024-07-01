const express = require('express');
const { spawn } = require('child_process');
const axios = require('axios');

const app = express();
app.use(express.json());
require('dotenv').config();


// Ver si esta funcionando
app.get('/', (req, res) => {
  res.send('Server is running');
});

// Ruta POST para iniciar el scraping y procesar los datos
app.post('/scrape', async (req, res) => {
  const { category, webhookUrl } = req.body;

  if (!category || !webhookUrl) {
    return res.status(400).send('Missing category or webhookUrl');
  }

  console.log(`Scraping data for category: ${category}`);

  const nodeProcess = spawn('node', ['scraper.js', category]);

  let scrapedDataString = '';

  nodeProcess.stdout.on('data', (data) => {
    scrapedDataString += data.toString();
    console.log(`Node stdout: ${data.toString()}`);
  });

  nodeProcess.stderr.on('data', (data) => {
    console.error(`Error running scraper: ${data.toString()}`);
    if (!res.headersSent) {
      res.status(500).send(`Error running scraper: ${data.toString()}`);
    }
  });

  nodeProcess.on('exit', async (code) => {
    console.log(`Node process exited with code ${code}`);

    if (code !== 0) {
      if (!res.headersSent) {
        res.status(500).send(`Scraper exited with code ${code}`);
      }
      return;
    }

    try {
      const email = process.env.EMAIL;
      const spreadsheetId = process.env.SPREADSHEET_ID;

      if (!spreadsheetId) {
        throw new Error('Missing SPREADSHEET_ID in .env');
      }

      const googleSheetsLink = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

      // Configuración de la solicitud POST al webhook
      const postData = {
        email: email,
        link: googleSheetsLink,
      };

      const headers = {
        'Content-Type': 'application/json'
      };

      // Envío de la solicitud POST al webhook
      const response = await axios.post(webhookUrl, postData, { headers });

      console.log('Webhook request sent with Google Sheets link:', googleSheetsLink);

      if (!res.headersSent) {
        res.status(200).send('Scraping completed and webhook request sent');
      }
    } catch (error) {
      console.error('Error sending webhook request:', error.message);

      if (!res.headersSent) {
        res.status(500).send(`Error sending webhook request: ${error.message}`);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
