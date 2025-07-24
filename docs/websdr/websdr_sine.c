// sine-wave tester (ignores input)
// /opt/wasi-sdk/bin/clang -mexec-model=reactor -O3 docs/websdr/websdr_sine.c -o docs/websdr_sine.wasm

#include <stdint.h>
#include <math.h>

#define SINE_FREQUENCY 440.0f       // 440Hz sine wave
static uint32_t phase_accumulator = 0;

// these are the fixed-length buffers used to pass data in/out of wasm
#define INPUT_LENGTH 262144
#define OUTPUT_LENGTH 8192
static int8_t input_bytes[INPUT_LENGTH];
static float output_audio[OUTPUT_LENGTH];

__attribute__((export_name("get_output_pointer")))
float* get_output_pointer() {
    return output_audio;
}

__attribute__((export_name("get_input_pointer")))
int8_t* get_input_pointer() {
    return input_bytes;
}

__attribute__((export_name("get_output_size")))
uint32_t get_output_size() {
    return OUTPUT_LENGTH * sizeof(float);
}

__attribute__((export_name("get_input_size")))
uint32_t get_input_size() {
    return INPUT_LENGTH;
}

__attribute__((export_name("process_samples")))
void process_samples(float audioSamplerate, float radioSamplerate) {
    // Generate sine wave - ignore input for now
    const float two_pi = 2.0f * M_PI;
    const float phase_increment = (SINE_FREQUENCY * two_pi) / audioSamplerate;
    for (int i = 0; i < OUTPUT_LENGTH; i++) {
        float phase = (float)phase_accumulator * phase_increment;
        output_audio[i] = 0.3f * sinf(phase);  // 0.3 amplitude to avoid clipping
        phase_accumulator++;
    }
}

