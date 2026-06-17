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
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

public class Programme3Uploader {

    private static final String LOG_FILE = "log_programme3.txt";
    private static final SimpleLogger logger = new SimpleLogger(LOG_FILE);
    private static final Gson gson = new Gson();
    private static final String API_URL = "http://localhost:8080/api/mp3/upload";
    private static final HttpClient httpClient = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    public static void main(String[] args) {
        logger.log("Démarrage du Programme 3 (Intégration API)");

        try {
            Connection connection = RabbitMQUtil.createConnection();
            Channel channel = connection.createChannel();

            RabbitMQUtil.declareQueues(channel);
            logger.log("Connecté à RabbitMQ. En attente de messages dans : " + RabbitMQUtil.QUEUE_META_MP3);

            DeliverCallback deliverCallback = (consumerTag, delivery) -> {
                String messageJson = new String(delivery.getBody(), StandardCharsets.UTF_8);

                try {
                    Mp3MetadataMessage metaMsg = gson.fromJson(messageJson, Mp3MetadataMessage.class);
                    File file = new File(metaMsg.getPath());

                    if (!file.exists()) {
                        logger.log("Erreur : Fichier introuvable " + metaMsg.getPath());
                        channel.basicAck(delivery.getEnvelope().getDeliveryTag(), false);
                        return;
                    }

                    logger.log("Début d'envoi du fichier " + file.getName());

                    // Multipart request building
                    String boundary = "---" + UUID.randomUUID().toString();
                    byte[] body = buildMultipartBody(metaMsg, file, boundary);

                    HttpRequest request = HttpRequest.newBuilder()
                            .uri(URI.create(API_URL))
                            .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                            .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                            .build();

                    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

                    if (response.statusCode() >= 200 && response.statusCode() < 300) {
                        logger.log("Envoi réussi");
                        // Nettoyage
                        Files.deleteIfExists(file.toPath());
                        logger.log(file.getName() + " supprimé du répertoire local.");
                        // Ack the message only if successful
                        channel.basicAck(delivery.getEnvelope().getDeliveryTag(), false);
                    } else {
                        logger.log("Échec de l'envoi : statut HTTP " + response.statusCode());
                        // Nack and requeue so it can be retried later
                        channel.basicNack(delivery.getEnvelope().getDeliveryTag(), false, true);
                    }

                } catch (Exception e) {
                    logger.log("Échec de l'envoi : serveur inaccessible ou erreur (" + e.getMessage() + ")");
                    // Nack and requeue
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

    private static byte[] buildMultipartBody(Mp3MetadataMessage metaMsg, File file, String boundary) throws IOException {
        StringBuilder sb = new StringBuilder();

        // Ajouter les métadonnées (json)
        sb.append("--").append(boundary).append("\r\n");
        sb.append("Content-Disposition: form-data; name=\"metadata\"\r\n");
        sb.append("Content-Type: application/json\r\n\r\n");
        sb.append(gson.toJson(metaMsg)).append("\r\n");

        // Ajouter le fichier
        sb.append("--").append(boundary).append("\r\n");
        sb.append("Content-Disposition: form-data; name=\"file\"; filename=\"").append(file.getName()).append("\"\r\n");
        sb.append("Content-Type: audio/mpeg\r\n\r\n");

        byte[] headerBytes = sb.toString().getBytes(StandardCharsets.UTF_8);
        byte[] fileBytes = Files.readAllBytes(file.toPath());
        byte[] footerBytes = ("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8);

        byte[] body = new byte[headerBytes.length + fileBytes.length + footerBytes.length];
        System.arraycopy(headerBytes, 0, body, 0, headerBytes.length);
        System.arraycopy(fileBytes, 0, body, headerBytes.length, fileBytes.length);
        System.arraycopy(footerBytes, 0, body, headerBytes.length + fileBytes.length, footerBytes.length);

        return body;
    }
}
