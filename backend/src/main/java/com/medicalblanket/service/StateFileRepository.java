package com.medicalblanket.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Optional;

/**
 * Small atomic JSON store for operational state that must survive a service restart.
 */
@Component
public class StateFileRepository {
    private static final Logger log = LoggerFactory.getLogger(StateFileRepository.class);
    private final ObjectMapper objectMapper;
    private final Path directory;

    public StateFileRepository(
            ObjectMapper objectMapper,
            @Value("${blanket.persistence.directory:./data}") String directory
    ) {
        this.objectMapper = objectMapper;
        this.directory = Path.of(directory).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.directory);
        } catch (IOException error) {
            log.warn("Could not create state directory {}", this.directory, error);
        }
    }

    public Optional<JsonNode> read(String fileName) {
        Path file = resolve(fileName);
        if (!Files.isRegularFile(file)) return Optional.empty();
        try {
            return Optional.of(objectMapper.readTree(Files.readString(file)));
        } catch (Exception error) {
            log.warn("Could not restore state from {}", file, error);
            return Optional.empty();
        }
    }

    public void write(String fileName, JsonNode payload) {
        Path target = resolve(fileName);
        Path temporary = null;
        try {
            Files.createDirectories(directory);
            temporary = Files.createTempFile(directory, fileName, ".tmp");
            Files.writeString(temporary, objectMapper.writeValueAsString(payload));
            try {
                Files.move(
                        temporary,
                        target,
                        StandardCopyOption.ATOMIC_MOVE,
                        StandardCopyOption.REPLACE_EXISTING
                );
            } catch (IOException atomicMoveError) {
                Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (Exception error) {
            log.warn("Could not persist state to {}", target, error);
        } finally {
            if (temporary != null) {
                try {
                    Files.deleteIfExists(temporary);
                } catch (IOException error) {
                    log.debug("Could not remove temporary state file {}", temporary, error);
                }
            }
        }
    }

    private Path resolve(String fileName) {
        Path target = directory.resolve(fileName).normalize();
        if (!target.getParent().equals(directory)) {
            throw new IllegalArgumentException("State file must stay inside the configured directory");
        }
        return target;
    }
}
