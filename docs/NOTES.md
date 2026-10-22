# Neuro Lab — Theory Notes

These notes explain the science behind every lab. Each lab links to its section here, sources are cited next to each model, and every model ends with its limitations: what it leaves out and where it stops being accurate.

## Notation and units

### Why fixed units?

A computer stores only numbers, not units. If one part of the code meant volts and another part millivolts, the results would be wrong by a factor of 1000, without any error message. So every simulation in Neuro Lab uses the same units:

| Quantity | Symbol | Unit | In SI units |
|---|---|---|---|
| Voltage (membrane potential) | $V$ | millivolt (mV) | $10^{-3}\ \text{V}$ |
| Time | $t$ | millisecond (ms) | $10^{-3}\ \text{s}$ |
| Current | $I$ | nanoampere (nA) | $10^{-9}\ \text{A}$ |
| Resistance | $R$ | megaohm (MΩ) | $10^{6}\ \Omega$ |
| Conductance | $g$ | microsiemens (µS) | $10^{-6}\ \text{S}$ |
| Capacitance | $C$ | nanofarad (nF) | $10^{-9}\ \text{F}$ |

These sizes suit neurons: membrane potentials are tens of millivolts, and a spike lasts about a millisecond.

### The units fit together

The units are chosen so that the usual formulas work without conversion factors. Ohm's law, $V = R \cdot I$, gives millivolts directly:

$$1\ \text{M}\Omega \cdot 1\ \text{nA} = 10^{6}\ \Omega \cdot 10^{-9}\ \text{A} = 10^{-3}\ \text{V} = 1\ \text{mV}$$

Conductance is the inverse of resistance, $g = 1/R$, so one microsiemens is one over a megaohm, and $I = g \cdot V$ gives nanoamperes:

$$1\ \mu\text{S} \cdot 1\ \text{mV} = 10^{-6}\ \text{S} \cdot 10^{-3}\ \text{V} = 10^{-9}\ \text{A} = 1\ \text{nA}$$

The membrane time constant $\tau = R \cdot C$, which appears in the first neuron model, comes out in milliseconds:

$$1\ \text{M}\Omega \cdot 1\ \text{nF} = 10^{6}\ \Omega \cdot 10^{-9}\ \text{F} = 10^{-3}\ \text{s} = 1\ \text{ms}$$

Why is one ohm times one farad one second? An ohm is a volt per ampere, a farad is a coulomb per volt, and an ampere is a coulomb per second:

$$\Omega \cdot \text{F} = \frac{\text{V}}{\text{A}} \cdot \frac{\text{C}}{\text{V}} = \frac{\text{C}}{\text{A}} = \frac{\text{C}}{\text{C}/\text{s}} = \text{s}$$

### Exceptions

Two models use other units, and their pages say so:

- **Hodgkin–Huxley** describes a small patch of membrane, so its values are per area: currents in µA/cm², conductances in mS/cm², capacitance in µF/cm².
- **Izhikevich**: the voltage $v$ is in mV and time in ms, but the input $I$ has no stated physical unit. It only says how strong the input is.
