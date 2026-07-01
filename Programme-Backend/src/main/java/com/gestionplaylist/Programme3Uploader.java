package com.gestionplaylist;

import com.gestionplaylist.models.Mp3MetadataMessage;
import com.gestionplaylist.utils.RabbitMQUtil;
import com.gestionplaylist.utils.SimpleLogger;
import com.google.gson.Gson;
import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.DeliverCallback;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.text.Normalizer;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public class Programme3Uploader {

    private static final String LOG_FILE            = "log_programme3.txt";
    private static final SimpleLogger logger        = new SimpleLogger(LOG_FILE);
    private static final Gson gson                  = new Gson();
    private static final String API_URL             = "http://localhost:5000/api/songs";
    private static final HttpClient httpClient      = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    private static final String BLACKLIST_FILE      = "C:\\Users\\HP\\OneDrive\\Documents\\GitHub\\Gestion-Playlist\\blacklist.txt";
    private static final String DURATION_LIMIT_FILE = "C:\\Users\\HP\\OneDrive\\Documents\\GitHub\\Gestion-Playlist\\duration_limit.txt";

    // Listes noires
    private static final Set<String> blacklistedGenres   = new HashSet<>();
    private static final Set<String> blacklistedArtists  = new HashSet<>();

    // Durée maximale autorisée (en secondes). -1 = pas de limite.
    private static long maxDurationSeconds = -1;

    // Timestamps de dernier chargement pour rechargement automatique
    private static long lastBlacklistLoadTime  = 0;
    private static long lastDurationLoadTime   = 0;

    public static void main(String[] args) {
        logger.log("Demarrage du Programme 3 (Integration API)");

        // Diagnostic chemin blacklist au demarrage
        logger.log("Chemin blacklist      : " + Paths.get(BLACKLIST_FILE).toAbsolutePath());
        logger.log("Fichier blacklist OK  : " + Files.exists(Paths.get(BLACKLIST_FILE)));
        logger.log("Chemin duree          : " + Paths.get(DURATION_LIMIT_FILE).toAbsolutePath());
        logger.log("Fichier duree OK      : " + Files.exists(Paths.get(DURATION_LIMIT_FILE)));

        loadBlacklist();
        loadDurationLimit();

        try {
            Connection connection = RabbitMQUtil.createConnection();
            Channel channel = connection.createChannel();

            RabbitMQUtil.declareQueues(channel);
            logger.log("Connecte a RabbitMQ. En attente de messages dans : " + RabbitMQUtil.QUEUE_META_MP3);

            DeliverCallback deliverCallback = (consumerTag, delivery) -> {
                String messageJson = new String(delivery.getBody(), StandardCharsets.UTF_8);

                try {
                    Mp3MetadataMessage metaMsg = gson.fromJson(messageJson, Mp3MetadataMessage.class);
                    File file = new File(metaMsg.getPath());

                    // Rechargement automatique si fichiers modifies
                    reloadBlacklistIfUpdated();
                    reloadDurationIfUpdated();

                    if (!file.exists()) {
                        logger.log("Erreur : Fichier introuvable " + metaMsg.getPath());
                        channel.basicAck(delivery.getEnvelope().getDeliveryTag(), false);
                        return;
                    }

                    // --- FILTRE DUREE ---
                    if (maxDurationSeconds > 0 && metaMsg.getDuration() > maxDurationSeconds) {
                        logger.log("DUREE DEPASSEE - Morceau ignore : '" + file.getName() + "'"
                                + " | Duree : " + metaMsg.getDuration() + "s"
                                + " | Limite : " + maxDurationSeconds + "s"
                                + " | Fichier CONSERVE sur le disque.");
                        // Acquittement sans envoi, fichier conserve
                        channel.basicAck(delivery.getEnvelope().getDeliveryTag(), false);
                        return;
                    }

                    // --- FILTRE BLACKLIST ---
                    if (isBlacklisted(metaMsg)) {
                        logger.log("BLACKLIST - Morceau ignore : '" + file.getName() + "'"
                                + " | Artiste : " + metaMsg.getArtist()
                                + " | Genre : " + metaMsg.getGenre()
                                + " | Fichier CONSERVE sur le disque.");
                        // Acquittement sans envoi, fichier conserve (NON supprime)
                        channel.basicAck(delivery.getEnvelope().getDeliveryTag(), false);
                        return;
                    }

                    logger.log("Debut d'envoi : " + file.getName()
                            + " [Artiste: " + metaMsg.getArtist()
                            + ", Genre: " + metaMsg.getGenre()
                            + ", Duree: " + metaMsg.getDuration() + "s"
                            + ", Langue: " + metaMsg.getLangue()
                            + ", Date: " + metaMsg.getReleaseDate() + "]");

                    // Envoi multipart vers l'API
                    String boundary = "---" + UUID.randomUUID().toString();
                    byte[] body = buildMultipartBody(metaMsg, file, boundary);

                    HttpRequest request = HttpRequest.newBuilder()
                            .uri(URI.create(API_URL))
                            .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                            .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                            .build();

                    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

                    if (response.statusCode() >= 200 && response.statusCode() < 300) {
                        logger.log("Envoi reussi : " + file.getName());

                        // Publier dans Queue_Envoi_OK pour que Programme 4 supprime le fichier
                        String metaJson = gson.toJson(metaMsg);
                        channel.basicPublish("", RabbitMQUtil.QUEUE_ENVOI_OK, null,
                                metaJson.getBytes(StandardCharsets.UTF_8));
                        logger.log("Message publie dans " + RabbitMQUtil.QUEUE_ENVOI_OK + " pour suppression par Programme 4.");

                        channel.basicAck(delivery.getEnvelope().getDeliveryTag(), false);
                    } else {
                        logger.log("Echec de l'envoi : statut HTTP " + response.statusCode());
                        channel.basicNack(delivery.getEnvelope().getDeliveryTag(), false, true);
                    }

                } catch (Exception e) {
                    logger.log("Echec de l'envoi : erreur (" + e.getMessage() + ")");
                    try {
                        channel.basicNack(delivery.getEnvelope().getDeliveryTag(), false, true);
                    } catch (IOException ioException) {
                        ioException.printStackTrace();
                    }
                }
            };

            channel.basicConsume(RabbitMQUtil.QUEUE_META_MP3, false, deliverCallback, consumerTag -> { });

        } catch (Exception e) {
            logger.log("Erreur critique : " + e.getMessage());
            e.printStackTrace();
        }
    }

    // =========================================================================
    // FILTRE DUREE
    // =========================================================================

    private static void loadDurationLimit() {
        Path path = Paths.get(DURATION_LIMIT_FILE);
        if (!Files.exists(path)) {
            logger.log("Info : Aucun fichier duration_limit.txt trouve. Aucune limite de duree active.");
            maxDurationSeconds = -1;
            return;
        }
        try {
            lastDurationLoadTime = Files.getLastModifiedTime(path).toMillis();
            List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);
            for (String line : lines) {
                line = line.trim();
                if (line.startsWith("\uFEFF")) line = line.substring(1).trim();
                if (line.isEmpty() || line.startsWith("#")) continue;
                try {
                    maxDurationSeconds = Long.parseLong(line);
                    logger.log("Limite de duree chargee : " + maxDurationSeconds + " secondes.");
                    return;
                } catch (NumberFormatException e) {
                    logger.log("Avertissement : valeur non numerique ignoree dans duration_limit.txt : '" + line + "'");
                }
            }
            logger.log("Avertissement : aucune valeur valide dans duration_limit.txt. Pas de limite active.");
            maxDurationSeconds = -1;
        } catch (IOException e) {
            logger.log("Erreur lecture duration_limit.txt : " + e.getMessage());
            maxDurationSeconds = -1;
        }
    }

    private static void reloadDurationIfUpdated() {
        Path path = Paths.get(DURATION_LIMIT_FILE);
        if (!Files.exists(path)) return;
        try {
            long lastModified = Files.getLastModifiedTime(path).toMillis();
            if (lastModified > lastDurationLoadTime) {
                logger.log("Modification detectee sur duration_limit.txt. Rechargement...");
                loadDurationLimit();
            }
        } catch (IOException e) {
            logger.log("Avertissement : impossible de verifier duration_limit.txt : " + e.getMessage());
        }
    }

    // =========================================================================
    // FILTRE BLACKLIST
    // =========================================================================

    private static String normaliser(String valeur) {
        if (valeur == null) return "";
        String decomposed = Normalizer.normalize(valeur, Normalizer.Form.NFD);
        return decomposed
                .replaceAll("\\p{M}", "")
                .replaceAll("[\\p{C}\\p{Z}\\s]+", " ")
                .trim()
                .toLowerCase();
    }

    private static boolean isBlacklisted(Mp3MetadataMessage metaMsg) {
        String genre  = normaliser(metaMsg.getGenre());
        String artist = normaliser(metaMsg.getArtist());

        logger.log("[DEBUG] Blacklist check :"
                + "\n  genre  brut='" + metaMsg.getGenre() + "' -> normalise='" + genre + "'"
                + "\n  artist brut='" + metaMsg.getArtist() + "' -> normalise='" + artist + "'"
                + "\n  genres  BL=" + blacklistedGenres
                + "\n  artists BL=" + blacklistedArtists);

        return blacklistedGenres.contains(genre) || blacklistedArtists.contains(artist);
    }

    private static void loadBlacklist() {
        Path path = Paths.get(BLACKLIST_FILE);
        if (!Files.exists(path)) {
            logger.log("Info : Aucun fichier blacklist.txt trouve. Aucun filtrage actif.");
            return;
        }
        List<String> lines = null;
        try {
            lastBlacklistLoadTime = Files.getLastModifiedTime(path).toMillis();
            lines = Files.readAllLines(path, StandardCharsets.UTF_8);
            logger.log("Blacklist lue en UTF-8.");
        } catch (IOException e) {
            logger.log("Lecture UTF-8 echouee, tentative Windows-1252...");
        }
        if (lines == null) {
            try {
                lines = Files.readAllLines(path, Charset.forName("windows-1252"));
                logger.log("Blacklist lue en Windows-1252.");
            } catch (IOException e) {
                logger.log("Erreur lecture blacklist : " + e.getMessage());
                return;
            }
        }
        blacklistedGenres.clear();
        blacklistedArtists.clear();
        for (String line : lines) {
            line = line.trim();
            if (line.startsWith("\uFEFF")) line = line.substring(1).trim();
            if (line.isEmpty() || line.startsWith("#")) continue;
            if (line.contains("=")) {
                String[] parts = line.split("=", 2);
                String type   = parts[0].trim().toUpperCase();
                String valeur = normaliser(parts[1]);
                switch (type) {
                    case "GENRE":
                        blacklistedGenres.add(valeur);
                        break;
                    case "ARTISTE":
                    case "ARTIST":
                        blacklistedArtists.add(valeur);
                        break;
                    default:
                        logger.log("Avertissement : type inconnu ignore : '" + type + "'");
                }
            }
        }
        logger.log("Blacklist chargee : "
                + blacklistedGenres.size() + " genre(s) : " + blacklistedGenres
                + " | " + blacklistedArtists.size() + " artiste(s) : " + blacklistedArtists);
    }

    private static void reloadBlacklistIfUpdated() {
        Path path = Paths.get(BLACKLIST_FILE);
        if (!Files.exists(path)) return;
        try {
            long lastModified = Files.getLastModifiedTime(path).toMillis();
            if (lastModified > lastBlacklistLoadTime) {
                logger.log("Modification detectee sur blacklist.txt. Rechargement...");
                loadBlacklist();
            }
        } catch (IOException e) {
            logger.log("Avertissement : impossible de verifier blacklist.txt : " + e.getMessage());
        }
    }

    // =========================================================================
    // CONSTRUCTION DU CORPS MULTIPART
    // =========================================================================

    private static byte[] buildMultipartBody(Mp3MetadataMessage metaMsg, File file, String boundary)
            throws IOException {
        StringBuilder sb = new StringBuilder();
        sb.append("--").append(boundary).append("\r\n");
        sb.append("Content-Disposition: form-data; name=\"metadata\"\r\n");
        sb.append("Content-Type: application/json\r\n\r\n");
        sb.append(gson.toJson(metaMsg)).append("\r\n");
        sb.append("--").append(boundary).append("\r\n");
        sb.append("Content-Disposition: form-data; name=\"audio\"; filename=\"").append(file.getName()).append("\"\r\n");
        sb.append("Content-Type: audio/mpeg\r\n\r\n");

        byte[] headerBytes = sb.toString().getBytes(StandardCharsets.UTF_8);
        byte[] fileBytes   = Files.readAllBytes(file.toPath());
        byte[] footerBytes = ("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8);

        byte[] body = new byte[headerBytes.length + fileBytes.length + footerBytes.length];
        System.arraycopy(headerBytes, 0, body, 0, headerBytes.length);
        System.arraycopy(fileBytes,   0, body, headerBytes.length, fileBytes.length);
        System.arraycopy(footerBytes, 0, body, headerBytes.length + fileBytes.length, footerBytes.length);
        return body;
    }
}