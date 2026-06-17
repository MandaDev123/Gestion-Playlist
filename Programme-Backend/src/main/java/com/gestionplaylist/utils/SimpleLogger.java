package com.gestionplaylist.utils;

import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

public class SimpleLogger {
    private final String logFile;
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm:ss");

    public SimpleLogger(String logFile) {
        this.logFile = logFile;
    }

    public void log(String message) {
        String timeStr = LocalTime.now().format(TIME_FORMATTER);
        String formattedMessage = String.format("[%s]\n%s\n", timeStr, message);

        System.out.println(formattedMessage.trim());

        try (PrintWriter out = new PrintWriter(new FileWriter(logFile, true))) {
            out.println(formattedMessage.trim());
        } catch (IOException e) {
            System.err.println("Erreur d'écriture dans le fichier de log: " + logFile);
            e.printStackTrace();
        }
    }
}
