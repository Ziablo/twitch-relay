const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
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
let streamLogs = [];

// Fonction pour ajouter un log
function addLog(message, isError = false) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        message,
        isError
    };
    streamLogs.push(logEntry);
    // Limiter à 100 entrées
    if (streamLogs.length > 100) {
        streamLogs.shift();
    }
    console.log(`${isError ? '[ERREUR]' : '[INFO]'} ${message}`);
}

// Télécharger et analyser le contenu M3U8
function downloadM3U8(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        
        protocol.get(url, (response) => {
            if (response.statusCode !== 200) {
                return reject(new Error(`Échec de téléchargement: ${response.statusCode}`));
            }
            
            let data = '';
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            response.on('end', () => {
                resolve(data);
            });
            
        }).on('error', (err) => {
            reject(err);
        });
    });
}

// Fonction pour trouver la meilleure qualité dans un fichier M3U8
async function findBestQualityStream(m3u8Url) {
    try {
        addLog(`Analyse du fichier M3U8: ${m3u8Url}`);
        const content = await downloadM3U8(m3u8Url);
        
        // Vérifions si c'est un manifest principal ou une playlist
        if (content.includes('#EXT-X-STREAM-INF')) {
            addLog('Master playlist détectée, recherche du flux de meilleure qualité');
            
            // Trouver toutes les résolutions disponibles
            const lines = content.split('\n');
            let bestBandwidth = 0;
            let bestStreamUrl = '';
            
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('#EXT-X-STREAM-INF')) {
                    const bandwidthMatch = lines[i].match(/BANDWIDTH=(\d+)/);
                    if (bandwidthMatch && parseInt(bandwidthMatch[1]) > bestBandwidth) {
                        bestBandwidth = parseInt(bandwidthMatch[1]);
                        // La ligne suivante devrait être l'URL
                        if (i + 1 < lines.length) {
                            let streamUrl = lines[i + 1].trim();
                            
                            // Si l'URL est relative, la convertir en absolue
                            if (!streamUrl.startsWith('http')) {
                                const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
                                streamUrl = baseUrl + streamUrl;
                            }
                            
                            bestStreamUrl = streamUrl;
                        }
                    }
                }
            }
            
            if (bestStreamUrl) {
                addLog(`Meilleure qualité trouvée: ${bestBandwidth} bps à ${bestStreamUrl}`);
                return bestStreamUrl;
            }
        }
        
        // Si aucun flux de meilleure qualité n'est trouvé ou ce n'est pas un manifest principal
        addLog('Utilisation de l\'URL M3U8 d\'origine');
        return m3u8Url;
    } catch (error) {
        addLog(`Erreur lors de l'analyse du M3U8: ${error.message}`, true);
        return m3u8Url;
    }
}

// Tester si FFmpeg est correctement installé
function testFfmpeg() {
    return new Promise((resolve) => {
        try {
            const command = ffmpeg().getAvailableCodecs();
            resolve({ installed: true, message: 'FFmpeg est correctement installé' });
        } catch (error) {
            resolve({ installed: false, message: `FFmpeg n'est pas correctement installé: ${error.message}` });
        }
    });
}

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

// Route pour obtenir les logs
app.get('/logs', (req, res) => {
    res.json(streamLogs);
});

// Route pour configurer et démarrer le stream
app.post('/start-stream', async (req, res) => {
    const { streamUrl } = req.body;
    
    if (!streamUrl) {
        addLog('URL du flux manquante', true);
        return res.status(400).json({ error: 'URL du flux manquante' });
    }

    // Vérifier la clé de stream Twitch
    if (!process.env.TWITCH_STREAM_KEY) {
        addLog('Clé de stream Twitch non configurée', true);
        return res.status(500).json({ error: 'Clé de stream Twitch non configurée' });
    }

    // Test de FFmpeg
    const ffmpegTest = await testFfmpeg();
    if (!ffmpegTest.installed) {
        addLog('FFmpeg non installé correctement', true);
        return res.status(500).json({ 
            error: 'FFmpeg non installé correctement',
            message: ffmpegTest.message
        });
    }

    // Arrêter le stream en cours s'il existe
    if (currentStream) {
        try {
            addLog('Arrêt du stream en cours...');
            currentStream.kill();
        } catch (error) {
            addLog(`Erreur lors de l'arrêt du stream en cours: ${error.message}`, true);
        }
    }

    try {
        // Déterminer si l'URL est un flux Twitch
        const isTwitchUrl = streamUrl.includes('ttvnw.net') || streamUrl.includes('twitch.tv');
        
        if (isTwitchUrl) {
            addLog('URL Twitch détectée, traitement spécial...');
        }

        // Trouver le meilleur flux de qualité si c'est un M3U8
        const bestQualityUrl = await findBestQualityStream(streamUrl);
        
        // URL de streaming Twitch
        const twitchUrl = `rtmp://live.twitch.tv/app/${process.env.TWITCH_STREAM_KEY}`;
        addLog('Démarrage du stream vers Twitch...');
        addLog(`URL source: ${bestQualityUrl}`);
        
        // Démarrer le nouveau stream avec des options supplémentaires pour les flux HLS
        currentStream = ffmpeg(bestQualityUrl)
            .inputOptions([
                '-re',              // Lire à vitesse normale
                '-analyzeduration 10M', // Augmenter le temps d'analyse
                '-probesize 10M',   // Augmenter la taille d'analyse
                '-fflags +genpts+discardcorrupt', // Gérer les erreurs
                '-reconnect 1',     // Reconnexion automatique
                '-reconnect_streamed 1',
                '-reconnect_delay_max 5'
            ])
            .outputOptions([
                '-c:v copy',        // Copier le codec vidéo
                '-c:a aac',         // Convertir l'audio en AAC
                '-ar 44100',        // Fréquence d'échantillonnage
                '-b:a 128k',        // Bitrate audio
                '-f flv',           // Format de sortie
                '-max_muxing_queue_size 9999' // File d'attente plus grande
            ])
            .output(twitchUrl)
            .on('start', (commandLine) => {
                addLog(`Stream démarré avec la commande: ${commandLine}`);
            })
            .on('error', (err, stdout, stderr) => {
                addLog(`Erreur de streaming: ${err.message}`, true);
                // Ajouter stdout et stderr aux logs pour le débogage
                if (stdout) addLog(`Sortie standard: ${stdout}`);
                if (stderr) addLog(`Erreur standard: ${stderr}`);
                currentStream = null;
            })
            .on('end', () => {
                addLog('Stream terminé');
                currentStream = null;
            });
        
        // Démarrer le stream de manière non bloquante
        currentStream.run();
        
        res.json({ 
            success: true, 
            message: 'Stream démarré avec succès',
            debug: {
                originalUrl: streamUrl,
                bestQualityUrl: bestQualityUrl,
                isTwitchUrl: isTwitchUrl,
                ffmpegInstalled: ffmpegTest.installed,
                ffmpegMessage: ffmpegTest.message
            }
        });
    } catch (error) {
        addLog(`Erreur lors du démarrage du stream: ${error.message}`, true);
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
            addLog('Arrêt du stream...');
            currentStream.kill();
            currentStream = null;
            res.json({ success: true, message: 'Stream arrêté avec succès' });
        } catch (error) {
            addLog(`Erreur lors de l'arrêt du stream: ${error.message}`, true);
            res.status(500).json({ error: 'Erreur lors de l\'arrêt du stream', message: error.message });
        }
    } else {
        addLog('Tentative d\'arrêt mais aucun stream en cours');
        res.json({ success: false, message: 'Aucun stream en cours' });
    }
});

// Route pour obtenir le statut du stream
app.get('/stream-status', (req, res) => {
    res.json({ 
        isStreaming: currentStream !== null,
        streamUrl: currentStream ? currentStream._inputs[0] : null,
        logs: streamLogs.slice(-10) // Retourner les 10 derniers logs
    });
});

// Route de healthcheck pour Heroku
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Démarrage du serveur
app.listen(port, () => {
    addLog(`Serveur de streaming démarré sur le port ${port}`);
}); 
