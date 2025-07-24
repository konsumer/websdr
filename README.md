I will eventiually be adding basic radio support to [null0](https://github.com/notnullgames/null0). The native layer will probly use [soapysdr](https://github.com/pothosware/SoapySDR), but I also wanted a web-based driver that could directly (over USB) do basic radio stuff.

For testing, I have a HackRFOne and a cheap RTL-SDR, so initially, tI will just get it working on HackRFOne, but I might expand it later.

I got some ideas from these:

- [hackrf-sweep](https://github.com/cho45/hackrf-sweep-webusb/blob/master/hackrf.js)
- [official SDK](https://github.com/greatscottgadgets/hackrf/blob/master/host/libhackrf/src/hackrf.h)
- [blog post about using hackrf on web](https://charliegerard.dev/blog/replay-attacks-javascript-hackrf/)

 At some point I will add some wasm-based units for DSP-processing, and setup a native/web host for the whole thing, so you can write processors in any language, and create a network in host (native or web.) I would like to eventually have something similar to gnuradio, but no re-compile, and you can make your processing-blocks in any language.