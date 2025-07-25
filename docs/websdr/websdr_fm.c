// FM demodulator for HackRF IQ data
// /opt/wasi-sdk/bin/clang -mexec-model=reactor -O3 docs/websdr/websdr_fm.c -o docs/websdr_fm.wasm

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

// Simple moving average for decimation
float decimate_avg(float *buffer, int count) {
    float sum = 0.0f;
    for (int i = 0; i < count; i++) {
        sum += buffer[i];
    }
    return sum / count;
}

__attribute__((export_name("process_samples")))
void process_samples(float audioSamplerate, float radioSamplerate) {
    int n_iq = INPUT_LENGTH / 2;
    int decim = (int)(radioSamplerate / audioSamplerate);
    int out_samples = n_iq / decim;
    if (out_samples > OUTPUT_LENGTH) out_samples = OUTPUT_LENGTH;
    
    // FM demodulator constants
    float gain = radioSamplerate / (2.0f * M_PI * 75000.0f); // 75kHz deviation for WFM
    float deemph_alpha = 1.0f - expf(-2.0f * M_PI * audioSamplerate * 75e-6f);
    
    // State variables
    static float prev_phase = 0.0f;
    static float deemph_state = 0.0f;
    float temp_buffer[32]; // For decimation
    
    // Process all samples
    for (int out_idx = 0; out_idx < out_samples; out_idx++) {
        // Collect samples for decimation
        int samples_to_avg = (decim < 32) ? decim : 32;
        
        for (int j = 0; j < samples_to_avg; j++) {
            int idx = (out_idx * decim + j) * 2;
            if (idx + 1 >= INPUT_LENGTH) {
                temp_buffer[j] = 0.0f;
                continue;
            }
            
            // Convert to float and normalize
            float i = input_bytes[idx] / 128.0f;
            float q = input_bytes[idx + 1] / 128.0f;
            
            // Calculate phase
            float phase = atan2f(q, i);
            
            // Calculate phase difference (FM demodulation)
            float dphase = phase - prev_phase;
            
            // Wrap phase difference to [-π, π]
            while (dphase > M_PI) dphase -= 2.0f * M_PI;
            while (dphase < -M_PI) dphase += 2.0f * M_PI;
            
            // Store demodulated value
            temp_buffer[j] = dphase * gain;
            prev_phase = phase;
        }
        
        // Decimate by averaging
        float audio = decimate_avg(temp_buffer, samples_to_avg);
        
        // De-emphasis filter (single-pole IIR)
        audio = deemph_state + deemph_alpha * (audio - deemph_state);
        deemph_state = audio;
        
        // Clamp output
        if (audio > 1.0f) audio = 1.0f;
        if (audio < -1.0f) audio = -1.0f;
        
        output_audio[out_idx] = audio;
    }
    
    // Zero out remaining samples
    for (int i = out_samples; i < OUTPUT_LENGTH; i++) {
        output_audio[i] = 0.0f;
    }
}