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
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

public class Programme4Cleaner {

    private static final String LOG_FILE   = "log_programme4.txt";
    private static final SimpleLogger logger = new SimpleLogger(LOG_FILE);
    private static final Gson gson           = new Gson();

    public static void main(String[] args) {
        logger.log("Demarrage du Programme 4 (Nettoyage)");

        try {
            Connection connection = RabbitMQUtil.createConnection();
            Channel channel = connection.createChannel();

            RabbitMQUtil.declareQueues(channel);
            logger.log("Connecte a RabbitMQ. En attente de messages dans : " + RabbitMQUtil.QUEUE_ENVOI_OK);

            DeliverCallback deliverCallback = (consumerTag, delivery) -> {
                String messageJson = new String(delivery.getBody(), StandardCharsets.UTF_8);

                try {
                    Mp3MetadataMessage metaMsg = gson.fromJson(messageJson, Mp3MetadataMessage.class);
                    File file = new File(metaMsg.getPath());

                    if (!file.exists()) {
                        logger.log("Info : fichier deja absent (deja supprime ?): " + metaMsg.getPath());
                        channel.basicAck(delivery.getEnvelope().getDeliveryTag(), false);
                        return;
                    }

                    boolean supprime = Files.deleteIfExists(file.toPath());

                    if (supprime) {
                        logger.log("Fichier supprime avec succes : " + file.getAbsolutePath()
                                + " [Titre: " + metaMsg.getTitle()
                                + ", Artiste: " + metaMsg.getArtist() + "]");
                    } else {
                        logger.log("Avertissement : fichier introuvable lors de la suppression : " + file.getAbsolutePath());
                    }

                    channel.basicAck(delivery.getEnvelope().getDeliveryTag(), false);

                } catch (Exception e) {
                    logger.log("Erreur lors de la suppression : " + e.getMessage());
                    try {
                        // On remet en file pour reessai
                        channel.basicNack(delivery.getEnvelope().getDeliveryTag(), false, true);
                    } catch (IOException ioException) {
                        ioException.printStackTrace();
                    }
                }
            };

            channel.basicConsume(RabbitMQUtil.QUEUE_ENVOI_OK, false, deliverCallback, consumerTag -> { });

        } catch (Exception e) {
            logger.log("Erreur critique : " + e.getMessage());
            e.printStackTrace();
        }
    }
}