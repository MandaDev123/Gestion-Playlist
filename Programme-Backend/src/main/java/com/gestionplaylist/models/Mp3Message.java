package com.gestionplaylist.models;

public class Mp3Message {
    private String path;

    public Mp3Message() {
    }

    public Mp3Message(String path) {
        this.path = path;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    @Override
    public String toString() {
        return "Mp3Message{" +
                "path='" + path + '\'' +
                '}';
    }
}
