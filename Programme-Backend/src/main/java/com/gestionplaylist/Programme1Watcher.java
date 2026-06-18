package com.gestionplaylist;

import com.gestionplaylist.models.Mp3Message;
import com.gestionplaylist.utils.RabbitMQUtil;
import com.gestionplaylist.utils.SimpleLogger;
import com.google.gson.Gson;
import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;

import java.io.File;
import java.io.IOException;
import java.nio.file.*;
import java.util.concurrent.TimeoutException;

public class Programme1Watcher {

    private static final String WATCH_DIR = "C:\\Users\\HP\\OneDrive\\Documents\\GitHub\\Gestion-Playlist\\Programme-Backend\\Musiques";
    private static final String LOG_FILE = "log_programme1.txt";
    private static final SimpleLogger logger = new SimpleLogger(LOG_FILE);
    private static final Gson gson = new Gson();

    public static void main(String[] args) {
        // Créer le dossier s'il n'existe pas
        File dir = new File(WATCH_DIR);
        if (!dir.exists()) {
            dir.mkdirs();
            logger.log("Dossier créé : " + WATCH_DIR);
        }

        logger.log("Démarrage du Programme 1 (Surveillance)");

        try (Connection connection = RabbitMQUtil.createConnection();
             Channel channel = connection.createChannel()) {

            RabbitMQUtil.declareQueues(channel);
            logger.log("Connecté à RabbitMQ. Surveillance de : " + WATCH_DIR);

            WatchService watchService = FileSystems.getDefault().newWatchService();
            Path path = Paths.get(WATCH_DIR);
            path.register(watchService, StandardWatchEventKinds.ENTRY_CREATE);

            while (true) {
                WatchKey key;
                try {
                    key = watchService.take();
                } catch (InterruptedException ex) {
                    logger.log("Surveillance interrompue.");
                    return;
                }

                for (WatchEvent<?> event : key.pollEvents()) {
                    WatchEvent.Kind<?> kind = event.kind();

                    if (kind == StandardWatchEventKinds.OVERFLOW) {
                        continue;
                    }

                    WatchEvent<Path> ev = (WatchEvent<Path>) event;
                    Path filename = ev.context();
                    Path child = path.resolve(filename);

                    if (filename.toString().toLowerCase().endsWith(".mp3")) {
    logger.log("Nouveau fichier détecté : " + filename.toString());

    // --- AJOUT : Attendre que le fichier soit complètement écrit ---
    int tentatives = 0;
    while (!Files.isReadable(child) && tentatives < 5) {
        try {
            logger.log("Fichier en cours d'écriture, attente...");
            Thread.sleep(500); // Attend 500 millisecondes
            tentatives++;
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }

    // On vérifie une dernière fois après l'attente
    if (!Files.isReadable(child)) {
        logger.log("Erreur : accès toujours refusé au fichier " + filename.toString());
        continue;
    }
    // --------------------------------------------------------------

    // Construire le message
    Mp3Message message = new Mp3Message(child.toAbsolutePath().toString().replace("\\", "/"));
    String jsonMessage = gson.toJson(message);

    // Envoyer dans RabbitMQ
    channel.basicPublish("", RabbitMQUtil.QUEUE_NOUVEAUX_MP3, null, jsonMessage.getBytes());
    logger.log("Message envoyé dans RabbitMQ : " + jsonMessage);
} else {
                        // Ignorer les autres fichiers
                        System.out.println("Fichier ignoré (non mp3) : " + filename.toString());
                    }
                }

                boolean valid = key.reset();
                if (!valid) {
                    break;
                }
            }

        } catch (IOException | TimeoutException e) {
            logger.log("Erreur critique : " + e.getMessage());
            e.printStackTrace();
        }
    }
}
