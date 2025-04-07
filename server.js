const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Assurez-vous que le dossier public existe
if (!fs.existsSync(path.join(__dirname, 'public'))) {
    fs.mkdirSync(path.join(__dirname, 'public'));
}

// Variable pour suivre l'état du stream
let streamStatus = {
    isStreaming: false,
    streamUrl: null
};

// Route principale
app.get('/', (req, res) => {
    // Vérifier si le fichier index.html existe
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send('<h1>Serveur de streaming Twitch</h1><p>Le fichier index.html est manquant.</p>');
    }
});

// Route pour configurer et démarrer le stream
app.post('/start-stream', async (req, res) => {
    const { streamUrl } = req.body;
    
    if (!streamUrl) {
        return res.status(400).json({ error: 'URL du flux manquante' });
    }

    // Dans un environnement de test, simulons le streaming
    try {
        streamStatus.isStreaming = true;
        streamStatus.streamUrl = streamUrl;
        
        console.log('Stream configuré avec URL:', streamUrl);
        res.json({ success: true, message: 'Stream configuré avec succès' });
    } catch (error) {
        console.error('Erreur lors de la configuration du stream:', error);
        res.status(500).json({ error: 'Erreur lors de la configuration du stream' });
    }
});

// Route pour arrêter le stream
app.post('/stop-stream', (req, res) => {
    if (streamStatus.isStreaming) {
        streamStatus.isStreaming = false;
        streamStatus.streamUrl = null;
        res.json({ success: true, message: 'Stream arrêté avec succès' });
    } else {
        res.json({ success: false, message: 'Aucun stream en cours' });
    }
});

// Route pour obtenir le statut du stream
app.get('/stream-status', (req, res) => {
    res.json(streamStatus);
});

// Route de healthcheck pour Heroku
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Démarrage du serveur
app.listen(port, () => {
    console.log(`Serveur de streaming démarré sur le port ${port}`);
}); 