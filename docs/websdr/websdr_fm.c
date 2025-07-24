// FM demodulator
// this still needs work, but you can kinda make out FM audio...
// /opt/wasi-sdk/bin/clang -mexec-model=reactor -O3 docs/websdr/websdr_fm.c -o docs/websdr_fm.wasm

#include <stdint.h>

#define INPUT_LENGTH 262144 * 4
#define OUTPUT_LENGTH 8192 * 4

static int8_t input_bytes[INPUT_LENGTH];
static float output_audio[OUTPUT_LENGTH];

// Optimized FM demod state
static float prev_i = 0.0f;
static float prev_q = 0.0f;
static float dc_filter = 0.0f;
static float audio_filter = 0.0f;

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
    int decimation = (int)(radioSamplerate / audioSamplerate);
    int iq_pairs = INPUT_LENGTH / 2;
    int audio_idx = 0;
    
    for (int i = 0; i < iq_pairs && audio_idx < OUTPUT_LENGTH; i += decimation) {
        // Convert to float with better scaling
        float I = (float)input_bytes[i * 2] / 128.0f;
        float Q = (float)input_bytes[i * 2 + 1] / 128.0f;
        
        // FM demodulation
        float demod = 0.0f;
        if (i > 0) {
            float cross = I * prev_q - Q * prev_i;
            float mag_sq = I*I + Q*Q + prev_i*prev_i + prev_q*prev_q; // Include previous magnitude
            if (mag_sq > 1e-6f) {
                demod = cross / (mag_sq * 0.5f); // Normalize by average magnitude
            }
        }
        
        prev_i = I;
        prev_q = Q;
        
        // Better DC blocking - higher cutoff frequency
        dc_filter = dc_filter * 0.99f + demod * 0.01f;
        float dc_removed = demod - dc_filter;
        
        // Audio low-pass filtering to reduce static
        audio_filter = audio_filter * 0.8f + dc_removed * 0.2f;
        
        // Better gain scaling
        float audio = audio_filter * 1.0f;
        
        // Soft limiting
        if (audio > 0.95f) audio = 0.95f;
        if (audio < -0.95f) audio = -0.95f;
        
        output_audio[audio_idx] = audio;
        audio_idx++;
    }
    
    // Fill remaining
    while (audio_idx < OUTPUT_LENGTH) {
        output_audio[audio_idx] = 0.0f;
        audio_idx++;
    }
}

