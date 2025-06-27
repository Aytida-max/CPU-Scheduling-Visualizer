document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const addProcessBtn = document.getElementById('add-process-btn');
    const addDefaultsBtn = document.getElementById('add-defaults-btn');
    const runSimulationBtn = document.getElementById('run-simulation-btn');
    const resetBtn = document.getElementById('reset-btn');
    const algorithmSelect = document.getElementById('algorithm-select');
    const quantumGroup = document.getElementById('quantum-group');

    const processNameInput = document.getElementById('process-name');
    const arrivalTimeInput = document.getElementById('arrival-time');
    const burstTimeInput = document.getElementById('burst-time');

    const processTableBody = document.querySelector('#process-table tbody');
    const ganttChart = document.getElementById('gantt-chart');
    const ganttTimeline = document.getElementById('gantt-chart-timeline');
    const statsTableBody = document.querySelector('#stats-table tbody');
    
    // --- Global State ---
    let processes = [];
    let processIdCounter = 1;
    const processColors = {};

    // --- Event Listeners ---
    addProcessBtn.addEventListener('click', addProcess);
    addDefaultsBtn.addEventListener('click', addDefaultProcesses);
    runSimulationBtn.addEventListener('click', runSimulation);
    resetBtn.addEventListener('click', resetAll);
    algorithmSelect.addEventListener('change', handleAlgorithmChange);
    
    // --- Functions ---
    
    function addProcess() {
        const name = processNameInput.value || `P${processIdCounter}`;
        const arrival = parseInt(arrivalTimeInput.value);
        const burst = parseInt(burstTimeInput.value);

        if (isNaN(arrival) || isNaN(burst) || burst <= 0 || arrival < 0) {
            alert('Please enter valid, non-negative arrival and positive burst times.');
            return;
        }

        const newProcess = {
            id: processIdCounter,
            name,
            arrival,
            burst,
            remaining: burst,
            finishTime: 0,
            turnaroundTime: 0,
            waitingTime: 0,
            normTurnaround: 0,
        };

        processes.push(newProcess);
        updateProcessTable();
        
        processNameInput.value = `P${processIdCounter + 1}`;
        processIdCounter++;
    }
    
    function addDefaultProcesses() {
        const defaultProcesses = [
            { name: 'P1', arrival: 0, burst: 8 },
            { name: 'P2', arrival: 1, burst: 4 },
            { name: 'P3', arrival: 2, burst: 9 },
            { name: 'P4', arrival: 3, burst: 5 },
        ];
        
        defaultProcesses.forEach(p => {
            const newProcess = { ...p, id: processIdCounter, remaining: p.burst };
            processes.push(newProcess);
            processIdCounter++;
        });
        updateProcessTable();
    }

    function updateProcessTable() {
        processTableBody.innerHTML = '';
        processes.forEach(p => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${p.name}</td>
                <td>${p.arrival}</td>
                <td>${p.burst}</td>
                <td><button onclick="removeProcess(${p.id})">Remove</button></td>
            `;
            processTableBody.appendChild(row);
        });
    }

    window.removeProcess = (id) => {
        processes = processes.filter(p => p.id !== id);
        updateProcessTable();
    };
    
    function handleAlgorithmChange() {
        quantumGroup.style.display = algorithmSelect.value === 'rr' ? 'block' : 'none';
    }

    function runSimulation() {
        if (processes.length === 0) {
            alert('Please add at least one process.');
            return;
        }
        
        // Deep copy processes to not mutate original data
        let simulationProcesses = JSON.parse(JSON.stringify(processes));
        simulationProcesses.sort((a, b) => a.arrival - b.arrival);
        
        assignProcessColors(simulationProcesses);
        
        const algorithm = algorithmSelect.value;
        let results;
        
        switch (algorithm) {
            case 'rr':
                const quantum = parseInt(document.getElementById('quantum').value);
                if (isNaN(quantum) || quantum <= 0) {
                    alert('Please enter a valid quantum for Round Robin.');
                    return;
                }
                results = runRoundRobin(simulationProcesses, quantum);
                break;
            case 'srt':
                results = runSRT(simulationProcesses);
                break;
            case 'hrrn':
                results = runHRRN(simulationProcesses);
                break;
        }
        
        renderGanttChart(results.gantt);
        renderStatsTable(results.stats);
    }
    
    function assignProcessColors(procs) {
        const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
        procs.forEach((p, i) => {
            processColors[p.id] = colors[i % colors.length];
        });
    }

    // --- Scheduling Algorithms ---

    function runRoundRobin(procs, quantum) {
        let currentTime = 0;
        const readyQueue = [];
        const gantt = [];
        let completed = 0;
        const n = procs.length;
        let procPointer = 0;

        while(completed < n) {
            // Add arriving processes to the ready queue
            while(procPointer < n && procs[procPointer].arrival <= currentTime) {
                readyQueue.push(procs[procPointer]);
                procPointer++;
            }

            if (readyQueue.length === 0) {
                gantt.push({ id: -1, start: currentTime, end: procs[procPointer].arrival, name: 'Idle' });
                currentTime = procs[procPointer].arrival;
                continue;
            }

            const currentProcess = readyQueue.shift();
            const executionTime = Math.min(quantum, currentProcess.remaining);
            
            gantt.push({ id: currentProcess.id, name: currentProcess.name, start: currentTime, end: currentTime + executionTime });
            
            currentTime += executionTime;
            currentProcess.remaining -= executionTime;
            
            // Add any processes that arrived during execution
            while(procPointer < n && procs[procPointer].arrival <= currentTime) {
                readyQueue.push(procs[procPointer]);
                procPointer++;
            }

            if (currentProcess.remaining > 0) {
                readyQueue.push(currentProcess);
            } else {
                currentProcess.finishTime = currentTime;
                completed++;
            }
        }
        return { gantt, stats: calculateStats(procs) };
    }

    function runSRT(procs) {
        let currentTime = 0;
        const gantt = [];
        let completed = 0;
        const n = procs.length;

        while (completed < n) {
            const readyProcesses = procs.filter(p => p.arrival <= currentTime && p.remaining > 0);

            if (readyProcesses.length === 0) {
                 const nextArrival = procs.find(p => p.arrival > currentTime);
                 const idleEndTime = nextArrival ? nextArrival.arrival : currentTime + 1;
                 if (idleEndTime > currentTime) {
                    gantt.push({ id: -1, name: 'Idle', start: currentTime, end: idleEndTime });
                 }
                 currentTime = idleEndTime;
                 continue;
            }

            readyProcesses.sort((a, b) => a.remaining - b.remaining);
            const currentProcess = readyProcesses[0];
            
            const nextPotentialInterrupt = procs.find(p => p.arrival > currentTime && p.arrival < currentTime + currentProcess.remaining && p.remaining < currentProcess.remaining - (p.arrival - currentTime));

            const runUntil = nextPotentialInterrupt ? nextPotentialInterrupt.arrival : currentTime + currentProcess.remaining;
            const executionTime = runUntil - currentTime;

            gantt.push({ id: currentProcess.id, name: currentProcess.name, start: currentTime, end: runUntil });
            
            currentProcess.remaining -= executionTime;
            currentTime = runUntil;

            if (currentProcess.remaining === 0) {
                currentProcess.finishTime = currentTime;
                completed++;
            }
        }
        return { gantt, stats: calculateStats(procs) };
    }

    function runHRRN(procs) {
        let currentTime = 0;
        const gantt = [];
        let completed = 0;
        const n = procs.length;

        while (completed < n) {
            let readyProcesses = procs.filter(p => p.arrival <= currentTime && p.remaining > 0);

            if (readyProcesses.length === 0) {
                const nextArrival = procs.find(p => p.arrival > currentTime);
                const idleEndTime = nextArrival ? nextArrival.arrival : currentTime + 1;
                if(idleEndTime > currentTime) {
                    gantt.push({ id: -1, name: 'Idle', start: currentTime, end: idleEndTime });
                }
                currentTime = idleEndTime;
                continue;
            }

            // Calculate response ratio for each ready process
            readyProcesses.forEach(p => {
                const waitingTime = currentTime - p.arrival;
                p.responseRatio = (waitingTime + p.burst) / p.burst;
            });

            readyProcesses.sort((a, b) => b.responseRatio - a.responseRatio);
            const currentProcess = readyProcesses[0];

            const executionTime = currentProcess.burst;
            gantt.push({ id: currentProcess.id, name: currentProcess.name, start: currentTime, end: currentTime + executionTime });
            
            currentTime += executionTime;
            currentProcess.remaining = 0;
            currentProcess.finishTime = currentTime;
            completed++;
        }

        return { gantt, stats: calculateStats(procs) };
    }

    // --- Rendering Functions ---

    function calculateStats(finishedProcs) {
        finishedProcs.forEach(p => {
            p.turnaroundTime = p.finishTime - p.arrival;
            p.waitingTime = p.turnaroundTime - p.burst;
            p.normTurnaround = (p.turnaroundTime / p.burst).toFixed(2);
        });
        return finishedProcs;
    }

    function renderGanttChart(ganttData) {
        ganttChart.innerHTML = '';
        ganttTimeline.innerHTML = '';
        const totalTime = ganttData[ganttData.length - 1].end;

        ganttData.forEach(block => {
            const blockDiv = document.createElement('div');
            const duration = block.end - block.start;
            blockDiv.className = 'gantt-block';
            blockDiv.style.width = `${(duration / totalTime) * 100}%`;
            blockDiv.textContent = block.name;
            if (block.id !== -1) {
                blockDiv.style.backgroundColor = processColors[block.id];
            } else {
                blockDiv.style.backgroundColor = '#bdc3c7'; // Idle color
                blockDiv.style.color = '#333';
            }
            ganttChart.appendChild(blockDiv);
        });
        
        // Render timeline
        for (let i = 0; i <= totalTime; i++) {
             const mark = document.createElement('div');
             mark.className = 'timeline-mark';
             mark.textContent = i;
             mark.style.left = `${(i / totalTime) * 100}%`;
             ganttTimeline.appendChild(mark);
        }
    }

    function renderStatsTable(statsData) {
        statsTableBody.innerHTML = '';
        let totalTurnaround = 0, totalWaiting = 0, totalNormTurnaround = 0;
        
        statsData.sort((a,b) => a.id - b.id).forEach(p => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${p.name}</td>
                <td>${p.finishTime}</td>
                <td>${p.turnaroundTime}</td>
                <td>${p.waitingTime}</td>
                <td>${p.normTurnaround}</td>
            `;
            statsTableBody.appendChild(row);
            totalTurnaround += p.turnaroundTime;
            totalWaiting += p.waitingTime;
            totalNormTurnaround += parseFloat(p.normTurnaround);
        });

        const avgRow = document.createElement('tr');
        avgRow.style.fontWeight = 'bold';
        avgRow.innerHTML = `
            <td>Average</td>
            <td>-</td>
            <td>${(totalTurnaround / statsData.length).toFixed(2)}</td>
            <td>${(totalWaiting / statsData.length).toFixed(2)}</td>
            <td>${(totalNormTurnaround / statsData.length).toFixed(2)}</td>
        `;
        statsTableBody.appendChild(avgRow);
    }
    
    function resetAll() {
        processes = [];
        processIdCounter = 1;
        updateProcessTable();
        ganttChart.innerHTML = '';
        ganttTimeline.innerHTML = '';
        statsTableBody.innerHTML = '';
    }
    
    // Initial setup
    handleAlgorithmChange();
});