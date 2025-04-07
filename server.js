const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
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
let currentStream = null;

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

    // Vérifier la clé de stream Twitch
    if (!process.env.TWITCH_STREAM_KEY) {
        return res.status(500).json({ error: 'Clé de stream Twitch non configurée' });
    }

    // Arrêter le stream en cours s'il existe
    if (currentStream) {
        try {
            currentStream.kill();
        } catch (error) {
            console.error('Erreur lors de l\'arrêt du stream en cours:', error);
        }
    }

    try {
        // URL de streaming Twitch
        const twitchUrl = `rtmp://live.twitch.tv/app/${process.env.TWITCH_STREAM_KEY}`;
        console.log('Démarrage du stream vers Twitch...');
        console.log('URL source:', streamUrl);
        
        // Démarrer le nouveau stream
        currentStream = ffmpeg(streamUrl)
            .inputOptions(['-re'])
            .outputOptions([
                '-c:v copy',
                '-c:a aac',
                '-ar 44100',
                '-b:a 128k',
                '-f flv'
            ])
            .output(twitchUrl)
            .on('start', (commandLine) => {
                console.log('Stream démarré avec la commande:', commandLine);
            })
            .on('error', (err, stdout, stderr) => {
                console.error('Erreur de streaming:', err.message);
                console.error('stdout:', stdout);
                console.error('stderr:', stderr);
                currentStream = null;
            })
            .on('end', () => {
                console.log('Stream terminé');
                currentStream = null;
            });
        
        // Démarrer le stream de manière non bloquante
        currentStream.run();
        
        res.json({ 
            success: true, 
            message: 'Stream démarré avec succès',
            debug: {
                streamUrl: streamUrl,
                ffmpegInstalled: typeof ffmpeg === 'function'
            }
        });
    } catch (error) {
        console.error('Erreur lors du démarrage du stream:', error);
        res.status(500).json({ 
            error: 'Erreur lors du démarrage du stream',
            message: error.message,
            stack: error.stack
        });
    }
});

// Route pour arrêter le stream
app.post('/stop-stream', (req, res) => {
    if (currentStream) {
        try {
            currentStream.kill();
            currentStream = null;
            res.json({ success: true, message: 'Stream arrêté avec succès' });
        } catch (error) {
            console.error('Erreur lors de l\'arrêt du stream:', error);
            res.status(500).json({ error: 'Erreur lors de l\'arrêt du stream', message: error.message });
        }
    } else {
        res.json({ success: false, message: 'Aucun stream en cours' });
    }
});

// Route pour obtenir le statut du stream
app.get('/stream-status', (req, res) => {
    res.json({ 
        isStreaming: currentStream !== null,
        streamUrl: currentStream ? currentStream._inputs[0] : null
    });
});

// Route de healthcheck pour Heroku
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Démarrage du serveur
app.listen(port, () => {
    console.log(`Serveur de streaming démarré sur le port ${port}`);
}); 
