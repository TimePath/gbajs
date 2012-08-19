ARMCoreArm = function (cpu) {
	this.constructBX = function(rm, condOp) {
		var gprs = cpu.gprs;
		return function() {
			if (condOp && !condOp()) {
				cpu.mmu.waitSeq32(gprs[cpu.PC]);
				return;
			}
			cpu.switchExecMode(gprs[rm] & 0x00000001);
			gprs[cpu.PC] = gprs[rm] & 0xFFFFFFFE;
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			cpu.mmu.wait32(gprs[cpu.PC]);
		};
	};

	this.constructLDM = function(rs, address, condOp) {
		var gprs = cpu.gprs;
		var mmu = cpu.mmu;
		return function() {
			mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			var addr = address();
			var m, i;
			for (m = 0x01, i = 0; i < 16; m <<= 1, ++i) {
				if (rs & m) {
					mmu.waitSeq32(addr);
					gprs[i] = mmu.load32(addr);
					addr += 4;
				}
			}
			++cpu.cycles;
		};
	};

	this.constructMSR = function(rm, r, instruction, immediate, condOp) {
		var gprs = cpu.gprs;
		var c = instruction & 0x00010000;
		//var x = instruction & 0x00020000;
		//var s = instruction & 0x00040000;
		var f = instruction & 0x00080000;
		return function() {
			cpu.mmu.waitSeq32(gprs[cpu.PC]);
			if (condOp && !condOp()) {
				return;
			}
			var operand;
			if (instruction & 0x02000000) {
				operand = immediate;
			} else {
				operand = gprs[rm];
			}
			var mask = (c ? 0x000000FF : 0x00000000) |
					   //(x ? 0x0000FF00 : 0x00000000) | // Irrelevant on ARMv4T
					   //(s ? 0x00FF0000 : 0x00000000) | // Irrelevant on ARMv4T
					   (f ? 0xFF000000 : 0x00000000);

			if (r) {
				mask &= cpu.USER_MASK | cpu.PRIV_MASK | cpu.STATE_MASK;
				cpu.spsr = (cpu.spsr & ~mask) | (operand & mask);
			} else {
				if (mask & cpu.USER_MASK) {
					cpu.cpsrN = operand & 0x80000000;
					cpu.cpsrZ = operand & 0x40000000;
					cpu.cpsrC = operand & 0x20000000;
					cpu.cpsrV = operand & 0x10000000;
				}
				if (cpu.mode != cpu.MODE_USER && (mask & cpu.PRIV_MASK)) {
					cpu.switchMode((operand & 0x0000000F) | 0x00000010);
					cpu.cpsrI = operand & 0x00000080;
					cpu.cpsrF = operand & 0x00000040;
				}
			}
		};
	};

	this.constructSTM = function(rs, address, condOp) {
		var gprs = cpu.gprs;
		var mmu = cpu.mmu;
		return function() {
			if (condOp && !condOp()) {
				mmu.waitSeq32(gprs[cpu.PC]);
				return;
			}
			var addr = address();
			var m, i;
			for (m = 0x01, i = 0; i < 16; m <<= 1, ++i) {
				if (rs & m) {
					mmu.wait32(addr);
					mmu.store32(addr, gprs[i]);
					addr += 4;
					break;
				}
			}
			for (m <<= 1, ++i; i < 16; m <<= 1, ++i) {
				if (rs & m) {
					mmu.waitSeq32(addr);
					mmu.store32(addr, gprs[i]);
					addr += 4;
				}
			}
			cpu.mmu.wait32(gprs[cpu.PC]);
		};
	};
};