package com.medicalblanket.mqtt;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class HexDataNormalizerTest {
    @Test
    void normalizesOnlyTheDataValueToCommaSeparatedHex() {
        assertThat(HexDataNormalizer.normalize("0xFF 0xAA")).isEqualTo("ff,aa");
        assertThat(HexDataNormalizer.normalize("ff,aa")).isEqualTo("ff,aa");
        assertThat(HexDataNormalizer.normalize("not-hex")).isEqualTo("not-hex");
    }
}
