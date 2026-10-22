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

$$
\begin{aligned}
1\ \text{M}\Omega \cdot 1\ \text{nA} &= 10^{6}\ \Omega \cdot 10^{-9}\ \text{A} \\
&= 10^{-3}\ \text{V} = 1\ \text{mV}
\end{aligned}
$$

Conductance is the inverse of resistance, $g = 1/R$, so one microsiemens is one over a megaohm, and $I = g \cdot V$ gives nanoamperes:

$$
\begin{aligned}
1\ \mu\text{S} \cdot 1\ \text{mV} &= 10^{-6}\ \text{S} \cdot 10^{-3}\ \text{V} \\
&= 10^{-9}\ \text{A} = 1\ \text{nA}
\end{aligned}
$$

The membrane time constant $\tau = R \cdot C$, which appears in the first neuron model, comes out in milliseconds:

$$
\begin{aligned}
1\ \text{M}\Omega \cdot 1\ \text{nF} &= 10^{6}\ \Omega \cdot 10^{-9}\ \text{F} \\
&= 10^{-3}\ \text{s} = 1\ \text{ms}
\end{aligned}
$$

Why is one ohm times one farad one second? An ohm is a volt per ampere, a farad is a coulomb per volt, and an ampere is a coulomb per second:

$$\Omega \cdot \text{F} = \frac{\text{V}}{\text{A}} \cdot \frac{\text{C}}{\text{V}} = \frac{\text{C}}{\text{A}} = \frac{\text{C}}{\text{C}/\text{s}} = \text{s}$$

### Exceptions

Two models use other units, and their pages say so:

- **Hodgkin–Huxley** describes a small patch of membrane, so its values are per area: currents in µA/cm², conductances in mS/cm², capacitance in µF/cm².
- **Izhikevich**: the voltage $v$ is in mV and time in ms, but the input $I$ has no stated physical unit. It only says how strong the input is.

## Solving differential equations numerically

### What a differential equation says

A neuron model doesn't tell us the voltage directly. It tells us how fast the voltage *changes*: a **differential equation** gives the derivative $\frac{dV}{dt}$, the slope of the curve $V(t)$, for every moment and every value of $V$.

The simplest example is part of every neuron model. Without input, the membrane voltage relaxes back to its resting value. If $V$ measures the distance from rest (in mV), then

$$\frac{dV}{dt} = -\frac{V}{\tau}$$

The minus sign means: if $V$ is positive it decreases, and the farther from rest, the faster. The **time constant** $\tau$ (in ms) sets the speed. This equation has an exact solution, which you can check by taking the derivative:

$$V(t) = V_0 \, e^{-t/\tau}$$

After one time constant ($t = \tau$), $e^{-1} \approx 0.37$, so 37 % of the starting value $V_0$ is left.

For most neuron models, for example Hodgkin–Huxley, nobody can write down such a formula. Then the computer builds the curve step by step from the slopes. This is called **numerical integration**, and a program that does it is a **solver**.

### Many variables at once

Real models have several variables that change together: Hodgkin–Huxley has four per neuron ($V$, $m$, $h$, $n$), and a network of 300 neurons has hundreds. We collect them in a **state vector** $y = (y_1, y_2, \dots, y_n)$ and write the whole model as one equation:

$$\frac{dy}{dt} = f(t, y)$$

The function $f$ takes the current time and state and returns the slope of every variable. The methods below work the same way for one variable or a thousand: they treat all components alike, at the same time.

### Euler's method: follow the tangent

The idea (Leonhard Euler, 1768) comes straight from the definition of the derivative. For a small time step $\Delta t$, the derivative is close to the difference quotient:

$$\frac{dy}{dt} \approx \frac{y(t + \Delta t) - y(t)}{\Delta t}$$

Solved for the new value, and with $f$ giving the slope:

$$y(t + \Delta t) \approx y(t) + \Delta t \cdot f(t, y(t))$$

So from the current point, walk a distance $\Delta t$ along the tangent, measure the new slope there and repeat:

$$y_{k+1} = y_k + \Delta t \cdot f(t_k, y_k)$$

The weakness: the slope is only measured at the *start* of each step. If the curve bends during the step, Euler ends up next to the curve, and these small mistakes add up.

For the decay equation, every Euler step multiplies $V$ by the same factor:

$$
\begin{aligned}
V_{k+1} &= V_k - \Delta t \cdot \frac{V_k}{\tau} \\
&= \left(1 - \frac{\Delta t}{\tau}\right) V_k
\end{aligned}
$$

After $N$ steps the factor has been applied $N$ times:

$$V_N = \left(1 - \frac{\Delta t}{\tau}\right)^{N} V_0$$

The time is then $t = N \Delta t$, so this is $\left(1 - \frac{t/\tau}{N}\right)^{N} V_0$. As the steps get smaller ($N \to \infty$), it approaches $e^{-t/\tau}\,V_0$: exactly the limit that defines the exponential function.

### Runge–Kutta 4: measure the slope four times

The classic fourth-order Runge–Kutta method (Runge 1895, Kutta 1901), "RK4" for short, measures the slope four times per step and takes a weighted average:

$$
\begin{aligned}
k_1 &= f(t_k,\ y_k) \\
k_2 &= f\left(t_k + \tfrac{\Delta t}{2},\ y_k + \tfrac{\Delta t}{2}\, k_1\right) \\
k_3 &= f\left(t_k + \tfrac{\Delta t}{2},\ y_k + \tfrac{\Delta t}{2}\, k_2\right) \\
k_4 &= f\left(t_k + \Delta t,\ y_k + \Delta t\, k_3\right) \\
y_{k+1} &= y_k + \frac{\Delta t}{6} \left(k_1 + 2k_2 + 2k_3 + k_4\right)
\end{aligned}
$$

- $k_1$ is the slope at the start of the step (the only one Euler uses).
- $k_2$ is the slope at the middle of the step, at the point reached by following $k_1$ for half a step.
- $k_3$ is the slope at the middle again, now reached with the better slope $k_2$.
- $k_4$ is the slope at the end of the step, reached with $k_3$.

The weights 1, 2, 2, 1 (out of 6) are the same as in Simpson's rule for integrals: the middle of the step counts most. If the slope depends only on time, RK4 *is* Simpson's rule.

Each step costs four evaluations of $f$ instead of one. But RK4 is so much more accurate that it can take far bigger steps for the same accuracy, which makes it cheaper overall.

For the decay equation, with $x = \Delta t / \tau$, one RK4 step multiplies $V$ by

$$1 - x + \frac{x^2}{2} - \frac{x^3}{6} + \frac{x^4}{24}$$

These are exactly the first five terms of the series of the true factor:

$$e^{-x} = 1 - x + \frac{x^2}{2} - \frac{x^3}{6} + \frac{x^4}{24} - \frac{x^5}{120} + \dots$$

RK4 gets the true factor right up to the $x^4$ term, Euler's factor $1 - x$ only up to the $x$ term.

### How big is the error?

Two kinds of error matter:

- The **local error** is the mistake made in a single step that starts exactly on the true curve. For the decay equation it is the difference between the step factor and $e^{-x}$. Euler misses the $\frac{x^2}{2}$ term, so its local error is about $\frac{x^2}{2}$, proportional to $\Delta t^2$. RK4 first misses the $\frac{x^5}{120}$ term, so its local error is proportional to $\Delta t^5$.
- The **global error** is what you see in the end: the difference from the true solution at a fixed time $T$. Getting there takes $N = T / \Delta t$ steps, and roughly, the local errors add up:

$$
\begin{aligned}
\text{global error} &\approx N \cdot C\,\Delta t^{\,p+1} \\
&= \frac{T}{\Delta t} \cdot C\,\Delta t^{\,p+1} \\
&= C\,T\,\Delta t^{\,p}
\end{aligned}
$$

The exponent $p$ is the **order** of the method: Euler has order 1, RK4 has order 4. This predicts what happens when the step is halved:

| Method | Order $p$ | Halving $\Delta t$ divides the global error by |
|---|---|---|
| Euler | 1 | $2^1 = 2$ |
| RK4 | 4 | $2^4 = 16$ |

So for Euler, 10 times more steps give 10 times more accuracy; for RK4, 10 times more steps give about 10,000 times more accuracy.

The factor is only *about* 16, because $C\,\Delta t^{\,p}$ is just the biggest part of the error. Smaller parts (proportional to $\Delta t^{\,p+1}$ and beyond) shift the ratio a little, and the smaller $\Delta t$ is, the closer the ratio gets to 16.

Measured with Neuro Lab's own solvers on the decay equation ($V_0 = 10$ mV, $\tau = 10$ ms), compared with the exact value $V(20\ \text{ms}) = 10 \cdot e^{-2} \approx 1.353$ mV:

| $\Delta t$ (ms) | Euler error (mV) | ratio | RK4 error (mV) | ratio |
|---|---|---|---|---|
| 1 | 0.138 | – | $2.45 \cdot 10^{-6}$ | – |
| 0.5 | 0.0682 | 2.02 | $1.47 \cdot 10^{-7}$ | 16.68 |
| 0.25 | 0.0340 | 2.01 | $9.00 \cdot 10^{-9}$ | 16.34 |
| 0.125 | 0.0170 | 2.00 | $5.56 \cdot 10^{-10}$ | 16.17 |

Both ratios move toward 2 and 16 as the step shrinks, just as predicted. Even at the largest step, RK4 is more than 50,000 times as accurate as Euler. The tests in `src/models/solvers.test.ts` check these properties automatically.

### Limits and pitfalls

- **Too big steps make the solution explode.** For the decay equation, Euler's factor $1 - \frac{\Delta t}{\tau}$ becomes negative when $\Delta t > \tau$ (the solution jumps from one side of zero to the other), and its size exceeds 1 when $\Delta t > 2\tau$: then the numerical voltage grows without limit, although the real one decays. RK4 stays stable a bit longer, up to about $\Delta t \approx 2.8\,\tau$. The fastest process in a model sets the limit. In Hodgkin–Huxley some ion channel gates change within a fraction of a millisecond, which is why that simulation uses steps of 0.01 ms.
- **Jumps break the error estimates.** The orders above assume a smooth curve. A spike reset, where the voltage jumps back instantly, is not smooth. So Neuro Lab never lets a solver step across such a jump: the solver only handles the smooth part, and jumps are applied between steps.
- **Rounding errors.** A computer stores numbers with limited precision. With 64-bit numbers (about 16 significant digits), rounding only matters once the method's error is extremely small. With 32-bit numbers (about 7 digits) it would already hide RK4's error at normal step sizes. That is why all model math in Neuro Lab uses 64-bit numbers.
- **Fixed steps.** Professional solvers adjust $\Delta t$ automatically: small steps where the curve bends sharply, big ones where it is nearly straight. Neuro Lab uses fixed steps, because they are easier to understand and keep animations and spike times simple.

Further reading: E. Hairer, S. P. Nørsett, G. Wanner, *Solving Ordinary Differential Equations I*, Springer (1993).

## Leaky integrate-and-fire neuron

### The idea

A neuron collects input. Its membrane voltage rises, and when the voltage reaches a **threshold**, the neuron fires a **spike** and starts over. Between inputs, charge leaks away, so a weak input can never make it fire. That is the whole leaky integrate-and-fire (LIF) model: *integrate* the input, *leak* toward rest, *fire* at the threshold.

The idea goes back to Louis Lapicque (1907), who described nerve excitation with a capacitor model long before anyone knew how a spike works. It is still one of the most used neuron models, because it is simple enough to calculate by hand and fast enough to simulate thousands of neurons.

### The membrane as an electric circuit

- The cell membrane is a very thin insulating layer between two salty, conducting liquids (inside and outside the cell). It stores electric charge like a **capacitor** with capacitance $C$.
- Some ion channels in the membrane are always open and let charge leak through. Together they act like a **resistor** $R$.
- Differences in ion concentrations between inside and outside act like a **battery** that pulls the voltage toward the **resting potential** $V_{\text{rest}}$, about $-65$ mV. Where this battery comes from is explained later in these notes, with the Hodgkin–Huxley model.
- An **input current** $I$ flows in, for example from an electrode in an experiment.

Charge is conserved: the input current either charges the capacitor or leaks out through the resistor (Kirchhoff's current law):

$$I = C\,\frac{dV}{dt} + \frac{V - V_{\text{rest}}}{R}$$

Multiplying by $R$ and writing $\tau = R \cdot C$ (the membrane time constant) gives the LIF equation:

$$\tau\,\frac{dV}{dt} = -\left(V - V_{\text{rest}}\right) + R\,I$$

The right side is the distance between the voltage and its target $V_{\text{rest}} + R\,I$. So the voltage moves toward that target, and the farther away it is, the faster it moves. It is the decay equation from the solver section again, only with a shifted target.

### Charging with a constant current

If the voltage doesn't change any more ($\frac{dV}{dt} = 0$), it has reached the **steady state**

$$V_{\infty} = V_{\text{rest}} + R\,I$$

Starting at rest, the voltage approaches this value exponentially, just like a charging capacitor:

$$V(t) = V_{\text{rest}} + R\,I\left(1 - e^{-t/\tau}\right)$$

After one time constant, it has covered 63 % of the way ($1 - e^{-1} \approx 0.63$).

### Fire and reset

The equation alone never produces a spike. The model adds a rule:

1. When $V$ reaches the threshold $\theta$, the neuron fires: the time is recorded as a spike.
2. $V$ is set to the reset value $V_{\text{reset}}$.
3. For the refractory period $t_{\text{ref}}$, the voltage stays at $V_{\text{reset}}$ and ignores all input. Real neurons also can't fire again immediately after a spike.

The spike itself, a fast rise and fall of the voltage lasting about a millisecond, is not simulated; only its time is. This is the trick that makes the model so simple. It works reasonably well because spikes of a neuron all look nearly the same, so for many questions their timing carries the information.

### When does the neuron fire? The rheobase

The voltage can never rise above its steady state $V_{\infty}$. If $V_{\infty}$ stays below the threshold, the neuron never fires, however long the input lasts. It fires only if

$$V_{\text{rest}} + R\,I > \theta$$

or, solved for the current,

$$I > \frac{\theta - V_{\text{rest}}}{R} = I_{\text{rheo}}$$

This smallest current is called the **rheobase**. With the default values, $I_{\text{rheo}} = \frac{-50\ \text{mV} - (-65\ \text{mV})}{10\ \text{M}\Omega} = 1.5$ nA. Exactly at the rheobase, the voltage gets closer and closer to $\theta$ but never reaches it.

### The time of the first spike

Starting at rest with a constant current above the rheobase, the first spike happens when $V(t_1) = \theta$:

$$
\begin{aligned}
\theta &= V_{\text{rest}} + R\,I\left(1 - e^{-t_1/\tau}\right) \\
e^{-t_1/\tau} &= 1 - \frac{\theta - V_{\text{rest}}}{R\,I} \\
&= \frac{R\,I - (\theta - V_{\text{rest}})}{R\,I} \\
t_1 &= \tau \ln \frac{R\,I}{R\,I - (\theta - V_{\text{rest}})}
\end{aligned}
$$

With the default values and $I = 2$ nA: $R\,I = 20$ mV and $t_1 = 10\ \text{ms} \cdot \ln\frac{20}{5} \approx 13.9$ ms. The tests check that the simulation hits such exact values.

### Parameters

| Symbol | Meaning | Default | On the page |
|---|---|---|---|
| $\tau$ | membrane time constant: how fast the voltage follows the input ($\tau = R\,C$) | 10 ms | 1 to 50 ms |
| $R$ | membrane resistance: how much a current shifts the voltage | 10 MΩ | 1 to 50 MΩ |
| $V_{\text{rest}}$ | resting potential: where the voltage goes without input | −65 mV | −80 to −55 mV |
| $\theta$ | threshold: the voltage at which a spike is fired | −50 mV | −58 to −30 mV |
| $V_{\text{reset}}$ | reset potential: the voltage right after a spike | −65 mV | −90 to −60 mV |
| $t_{\text{ref}}$ | refractory period: how long the voltage is held at reset after a spike | 2 ms | 0 to 20 ms |
| $I$ | input current, constant or switched on from 50 to 150 ms | 2 nA | −2 to 5 nA |

The defaults are typical textbook values (similar values are used, for example, in Dayan & Abbott, *Theoretical Neuroscience*, 2001, chapter 5). They don't describe one particular real neuron. The ranges keep $V_{\text{reset}}$ below $\theta$; otherwise the neuron would fire again immediately after every reset.

### How Neuro Lab simulates it

Between spikes the voltage follows a smooth equation, so it is solved with RK4 and a time step of $\Delta t = 0.1$ ms.

After every step the program checks whether $V$ has crossed $\theta$. If it went from $V_{\text{before}}$ to $V_{\text{after}} > \theta$ during the step, the crossing time is found by linear interpolation:

$$t_{\text{spike}} = t + \Delta t \cdot \frac{\theta - V_{\text{before}}}{V_{\text{after}} - V_{\text{before}}}$$

Without this, every spike time would be rounded up to the next step, with an error of up to 0.1 ms. The refractory period is counted from this exact spike time; if it ends in the middle of a step, only the rest of that step is simulated. The input current is held constant during each step, and the step current switches exactly at step boundaries.

### Limitations

- **A single point.** The whole neuron has one voltage. Real neurons have long dendrites and an axon, and the voltage differs along them.
- **A constant leak.** Real membranes have ion channels that open and close depending on the voltage. They create the spike's shape and effects like bursting, which this model can't show (the Izhikevich and Hodgkin–Huxley models later in these notes can).
- **No spike shape, a fixed threshold.** Real thresholds vary with the recent history of the neuron.
- **No adaptation.** Under a constant input, many real neurons fire more and more slowly. The LIF neuron fires perfectly regularly.
- **Current input.** The input here is a current injected by an electrode. Real synapses change the membrane's conductance instead (covered later in these notes, with synapses).
- **No noise.** Real neurons fire somewhat irregularly; this model always does exactly the same thing.

## Firing rate and the f-I curve

### What the f-I curve shows

A classic experiment: inject a constant current $I$ into a neuron, count its spikes, repeat with a stronger current. Plotting the **firing rate** $f$ (spikes per second, in Hz) against the current gives the **f-I curve** ("frequency–current curve"). It is one of the most basic fingerprints of a neuron type. For the LIF neuron it can be calculated exactly, which makes it a perfect test for the simulation.

### The time between two spikes

Look at one cycle with a constant current above the rheobase. Right after a spike, the voltage sits at $V_{\text{reset}}$ for the refractory period $t_{\text{ref}}$. Then it charges up toward its target $V_{\infty} = V_{\text{rest}} + R\,I$. Measuring time $t$ from the end of the refractory period, this is the charging curve from before, only starting at $V_{\text{reset}}$:

$$V(t) = V_{\infty} + \left(V_{\text{reset}} - V_{\infty}\right) e^{-t/\tau}$$

The next spike comes when $V$ reaches $\theta$. Solving for the climbing time $t_{\text{climb}}$:

$$
\begin{aligned}
\theta &= V_{\infty} + \left(V_{\text{reset}} - V_{\infty}\right) e^{-t_{\text{climb}}/\tau} \\
e^{-t_{\text{climb}}/\tau} &= \frac{V_{\infty} - \theta}{V_{\infty} - V_{\text{reset}}} \\
t_{\text{climb}} &= \tau \ln \frac{V_{\infty} - V_{\text{reset}}}{V_{\infty} - \theta}
\end{aligned}
$$

With $V_{\infty} - V_{\text{reset}} = R\,I - (V_{\text{reset}} - V_{\text{rest}})$ and $V_{\infty} - \theta = R\,I - (\theta - V_{\text{rest}})$, the whole **interspike interval** (time from one spike to the next) is

$$T = t_{\text{ref}} + \tau \ln \frac{R\,I - (V_{\text{reset}} - V_{\text{rest}})}{R\,I - (\theta - V_{\text{rest}})}$$

If the reset is the resting potential ($V_{\text{reset}} = V_{\text{rest}}$), the first term in the numerator disappears:

$$T = t_{\text{ref}} + \tau \ln \frac{R\,I}{R\,I - (\theta - V_{\text{rest}})}$$

Every interval is the same, because every cycle starts from the same state: $V_{\text{reset}}$ at the end of the refractory period. So the neuron fires perfectly regularly, with the rate

$$f = \frac{1}{T}$$

With $T$ in ms, $f = 1000 / T$ in Hz. With the default values and $I = 2$ nA: $T = 2 + 10 \ln 4 \approx 15.86$ ms, so $f \approx 63.0$ Hz. The first spike is different, because it starts from $V_{\text{rest}}$ instead of $V_{\text{reset}}$ and has no refractory period before it. That is why the rate is measured from the intervals *between* spikes. Below or at the rheobase, the neuron never fires and $f = 0$.

### The shape of the curve

**Just above the rheobase**, the denominator $R\,I - (\theta - V_{\text{rest}})$ is tiny, the logarithm is huge, and the interval is very long. As $I$ approaches the rheobase, $T \to \infty$ and $f \to 0$: the LIF neuron can fire arbitrarily slowly, and its f-I curve starts continuously at zero. It rises very steeply there, because the logarithm grows only slowly as its argument gets large.

**For large currents**, the fraction in the logarithm is close to 1. To see how close, write $a = V_{\text{reset}} - V_{\text{rest}}$ and $b = \theta - V_{\text{rest}}$ for short:

$$
\begin{aligned}
\frac{R\,I - a}{R\,I - b} &= 1 + \frac{b - a}{R\,I - b} \\
&\approx 1 + \frac{\theta - V_{\text{reset}}}{R\,I}
\end{aligned}
$$

because $b - a = \theta - V_{\text{reset}}$, and for a large current $R\,I - b \approx R\,I$. For small $x$, $\ln(1 + x) \approx x$. So

$$T \approx t_{\text{ref}} + \frac{\tau\,(\theta - V_{\text{reset}})}{R\,I}$$

The climbing time shrinks like $1/I$, and the rate approaches its maximum $f_{\max} = 1 / t_{\text{ref}}$: 500 Hz for $t_{\text{ref}} = 2$ ms. The refractory period is one reason why real neurons can't fire faster than a few hundred spikes per second. Without a refractory period, $f \approx \frac{R\,I}{\tau\,(\theta - V_{\text{reset}})}$ would grow without limit, proportionally to the current.

The British physiologist Alan Hodgkin (1948) sorted the nerve fibers of crabs by the shape of their f-I curves. "Class 1" neurons, like the LIF model, can fire at any low rate. "Class 2" neurons start firing at a clearly nonzero rate as soon as they fire at all; the Hodgkin–Huxley model later in these notes is an example.

### How the page measures the simulated curve

- Every dot is its own simulated neuron with a constant current. All of them are simulated together as one population, for 1 second, with $\Delta t = 0.1$ ms.
- The rate is the number of intervals divided by the time between the first and the last spike, in other words $1/$(mean interval). The first spike is left out because it starts from rest.
- A rate needs at least two spikes. Currents just above the rheobase may fire too slowly for that within 1 second; they get no dot. A neuron without any spike counts as 0 Hz.

How close should the dots be to the line? The spike times are interpolated with a straight line between two time steps (see the LIF section). The true voltage curve bends slightly, with $\frac{d^2V}{dt^2} = -\frac{1}{\tau}\frac{dV}{dt}$. A straight line between two points of such a curve misses the true crossing time by at most

$$\frac{\Delta t^2}{8\,\tau}$$

which is $1.25 \cdot 10^{-4}$ ms for the default values. The mean interval comes from the first and last spike only, so its error is at most twice that, and the relative error of the rate is at most $\frac{\Delta t^2}{4\,\tau\,T}$. For an interval of 4 ms that is below 0.01 %. Without interpolation, every spike would be up to 0.1 ms late, and fast rates would be off by a few percent.

### Limitations

- **No adaptation.** Many real neurons start firing fast and then slow down during a constant current, so their "f-I curve" depends on when the spikes are counted. The LIF neuron fires at one constant rate.
- **No noise.** In real neurons, noise lets the cell fire now and then even slightly below the rheobase, which smooths the sharp corner of the curve.
- **Only class 1.** Neurons that start firing at a nonzero minimum rate (class 2) can't be described by this model.
