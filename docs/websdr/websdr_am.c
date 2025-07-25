// AM demodulator.
// /opt/wasi-sdk/bin/clang -mexec-model=reactor -O3 docs/websdr/websdr_am.c -o docs/websdr_am.wasm

#include <stdint.h>
#include <math.h>

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
    // HackRF outputs interleaved I/Q samples as signed 8-bit integers
    // Each pair represents one complex sample (I, Q)
    int num_complex_samples = INPUT_LENGTH / 2; // 131072 complex samples
    
    // Decimation factor to get from 131072 to 8192 samples
    int decimation = num_complex_samples / OUTPUT_LENGTH; // 16
    
    for (int i = 0; i < OUTPUT_LENGTH; i++) {
        int input_idx = i * decimation * 2; // Account for I/Q interleaving
        
        // Extract I and Q components
        float I = (float)input_bytes[input_idx] / 127.0f;     // Normalize to ±1
        float Q = (float)input_bytes[input_idx + 1] / 127.0f; // Normalize to ±1
        
        // Convert to magnitude (AM demodulation)
        output_audio[i] = sqrtf(I*I + Q*Q);
    }
}