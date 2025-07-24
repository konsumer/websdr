// simple FM demodulator for HackRF (WASM)
// /opt/wasi-sdk/bin/clang -mexec-model=reactor -O3 docs/websdr/websdr_fm.c -o docs/websdr_fm.wasm

#include <stdint.h>
#include <stddef.h>
#include <math.h>
#include <string.h>

typedef struct {
    float I, Q;
} complex_t;

typedef struct {
    float last_I, last_Q;
    float filter_state;
    int decimation_counter;
} fm_processor_t;

#define INPUT_LENGTH 262144
#define OUTPUT_LEGNTH 8192

#define PRE_DECIMATION 10 // 20MHz -> 2MHz
#define FINAL_DECIMATION 42 // 2MHz -> ~48kHz

#define SAMPLE_RATE 2000000.0f
#define CUTOFF_FREQ  15000.0f
const float ALPHA = (1.0f / SAMPLE_RATE) / ((1.0f / (2.0f * M_PI * CUTOFF_FREQ)) + (1.0f / SAMPLE_RATE));

static int8_t input_bytes[INPUT_LENGTH];
static float output_audio[OUTPUT_LEGNTH];
static fm_processor_t processor = {0};

static inline float low_pass_filter(float input, float* state, float alpha) {
    *state = *state + alpha * (input - *state);
    return *state;
}

static inline float fm_demodulate(float curr_I, float curr_Q, float prev_I, float prev_Q) {
    // Complex multiplication for phase difference
    float real = curr_I * prev_I + curr_Q * prev_Q;
    float imag = curr_Q * prev_I - curr_I * prev_Q;
    return atan2f(imag, real);
}

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
    return OUTPUT_LEGNTH * sizeof(float);
}

__attribute__((export_name("get_input_size")))
uint32_t get_input_size() {
    return INPUT_LENGTH;
}

__attribute__((export_name("process_samples")))
int process_samples() {
    size_t output_count = 0;

    // Process I/Q pairs with pre-decimation
    for (size_t i = 0; i < INPUT_LENGTH - 1 && output_count < OUTPUT_LEGNTH; i += PRE_DECIMATION * 2) {
        // Convert int8 to normalized float
        float curr_I = (float)input_bytes[i] / 128.0f;
        float curr_Q = (float)input_bytes[i + 1] / 128.0f;
        
        // FM demodulation
        float audio_sample = fm_demodulate(curr_I, curr_Q, processor.last_I, processor.last_Q);
        
        // Update state
        processor.last_I = curr_I;
        processor.last_Q = curr_Q;
        
        // Low-pass filter
        audio_sample = low_pass_filter(audio_sample * 0.3f, &processor.filter_state, ALPHA);
        
        // Final decimation
        if (++processor.decimation_counter >= FINAL_DECIMATION) {
            processor.decimation_counter = 0;
            output_audio[output_count++] = audio_sample;
        }
    }
    
    return output_count;
}
