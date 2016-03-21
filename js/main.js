// http://codepen.io/HarrisCarney/pen/JGmqC
function set_background_canvas() {
    var canvas = $('#background-canvas')[0];
    var context = canvas.getContext('2d');

    var Dots    = [];
    var ID      = 0;
    var colors  = ['#FF9900', '#424242', '#BCBCBC', '#3299BB', '#B9D3B0', '#81BDA4', '#F88F79', '#F6AA93'];
    var maximum = 160;

    function Dot() {
        this.active = true;
        this.id = ID; ID++;

        this.diameter = 2 + Math.random() * 7;

        this.x = Math.round(Math.random() * canvas.width);
        this.y = Math.round(Math.random() * canvas.height);

        this.velocity = {
            x: (Math.random() < 0.5 ? -1 : 1) * Math.random() * 5.4,
            y: (Math.random() < 0.5 ? -1 : 1) * Math.random() * 5.4
        };

        this.alpha = 0.1;
        this.maxAlpha = this.diameter < 5 ? 0.3 : 0.8;
        this.hex = colors[Math.round(Math.random() * 7)];
        this.color = HexToRGBA(this.hex, this.alpha);
    }

    Dot.prototype = {
        Update: function() {
            if(this.alpha <= this.maxAlpha) {
                this.alpha += 0.005;
                this.color = HexToRGBA(this.hex, this.alpha);
            }

            this.x += this.velocity.x;
            this.y += this.velocity.y;

            if(this.x > canvas.width + 5 || this.x < 0 - 5 || this.y > canvas.height + 5 || this.y < 0 - 5) {
                this.active = false;
            }
        },

        Draw: function() {
            context.strokeStyle = this.color;
            context.fillStyle = this.color;
            context.save();
            context.beginPath();
            context.translate(this.x, this.y);
            context.moveTo(0, -this.diameter);

            for (var i = 0; i < 7; i++)
            {
                context.rotate(Math.PI / 7);
                context.lineTo(0, -(this.diameter / 2));
                context.rotate(Math.PI / 7);
                context.lineTo(0, -this.diameter);
            }

            if(this.id % 2 == 0) {
                context.stroke();
            } else {
                context.fill();
            }

            context.closePath();
            context.restore();
        }
    }

    function Update() {
        GenerateDots();

        Dots.forEach(function(Dot) {
            Dot.Update();
        });

        Dots = Dots.filter(function(Dot) {
            return Dot.active;
        });

        Render();
        requestAnimationFrame(Update);
    }

    function Render() {
        context.clearRect(0, 0, canvas.width, canvas.height);
        Dots.forEach(function(Dot) {
            Dot.Draw();
        });
    }

    function GenerateDots() {
        if(Dots.length < maximum) {
            for(var i = Dots.length; i < maximum; i++) {
                Dots.push(new Dot());
            }
        }

        return false;
    }

    function HexToRGBA(hex, alpha) {
        var red   = parseInt((TrimHex(hex)).substring(0, 2), 16);
        var green = parseInt((TrimHex(hex)).substring(2, 4), 16);
        var blue  = parseInt((TrimHex(hex)).substring(4, 6), 16);

        return "rgba(" + red + ', ' + green + ', ' + blue + ', ' + alpha + ")";
    }

    function TrimHex(hex) {
        return (hex.charAt(0) == "#") ? hex.substring(1, 7) : hex;
    }

    // function WindowSize(width, height) {
    //     if(width != null) { canvas.width = width; } else { canvas.width = window.innerWidth; }
    //     if(height != null) { canvas.height = height; } else { canvas.height = window.innerHeight; }
    // }

    // $(window).resize(function() {
    //     Dots = [];
    //     WindowSize();
    // });

    // WindowSize();
    GenerateDots();
    Update();
};


window.onload = function()
{
    var editor    = null;
    var assembler = null;
    var vm        = null;
    var program   = null;
    var ast       = null;
    var snap      = null;

    function init_editor()
    {
        var editor = ace.edit('editor');
        editor.$blockScrolling = Infinity;
        editor.setTheme('ace/theme/github');
        editor.setValue([
                ['PRG1 START'],
                ['     LD   GR0, A'],
                ['     ADDA GR0, B'],
                ['     ST   GR0, ANS'],
                ['     RET'],
                ['A    DC 35'],
                ['B    DC 7'],
                ['ANS  DS 1'],
                ['     END'],
        ].join("\n")
        );

        return editor;
    }

    function resize_diagram()
    {
        var w = $('#diagram_wrapper').width();
        var h = window.innerHeight * 0.771;

        $('#anim-canvas').attr('width', w);
        $('#anim-canvas').attr('height', h);
        $('#diagram').attr('width', w);
        $('#diagram').attr('height', h);
        $('#background-canvas').attr('width', w);
        $('#background-canvas').attr('height', h);
    }

    function init_diagrams()
    {
        const REGISTER_SIZE_X = 200;
        const REGISTER_SIZE_Y = 40;

        const ATTR_REGISTER = {
            stroke: '#000000',
            strokeWidth: 1,
            fill: 'none',
        };

        const ATTR_FONT = {
            fontSize:   '18px',
            textAnchor: 'start',
            dominantBaseline: 'middle',
            overflow: 'visible',
        };

        const ATTR_ALU = {
            stroke: '#000000',
            strokeWidth: 1,
            fill: 'none',
        };

        const ATTR_LINE = {
            stroke: '#E95464',
            strokeWidth: 5,
            fill: 'none',
        };

        const MARKER_NONE   = 0x00;
        const MARKER_R270   = 0x01;
        const MARKER_R90    = 0x02;
        const MARKER_R0     = 0x04;
        const MARKER_R180   = 0x08;
        const MARKER_START  = 0x10;
        const MARKER_MIDDLE = 0x20;
        const MARKER_END    = 0x40;

        var s = Snap('#diagram');

        function draw_register(tag, x, y)
        {
            var value_size_x = REGISTER_SIZE_X * (5.0 / 7.0);
            var tag_size_x   = REGISTER_SIZE_X * (2.0 / 7.0);

            var register_tag        = s.rect(x, y, tag_size_x, REGISTER_SIZE_Y).attr(ATTR_REGISTER);
            var register_value      = s.rect(x + tag_size_x, y, value_size_x, REGISTER_SIZE_Y).attr(ATTR_REGISTER);
            var txt_margin_x    = 7;
            var txt_margin_y    = 23;
            var txt_tag         = s.text(x + txt_margin_x, y + txt_margin_y, tag).attr(ATTR_FONT);
            var txt_value       = s.text(x + tag_size_x + txt_margin_x, y + txt_margin_y, '0x0000 0000').attr(ATTR_FONT);
            var class_name_part = tag.replace(/\s+/g, '');
            txt_value.addClass('register-text-' + class_name_part);

            var group = s.group(register_tag, register_value, txt_tag, txt_value);
            group.addClass('register-' + class_name_part);

            return group;
        }

        function draw_alu(tag, x, y)
        {
            var alu = s.path('M' + x.toString() + ',' + y.toString() + ' v50 l40,30 l-40,30 v50 l70,-50 v-60 l-70,-50').attr(ATTR_ALU);
            alu.addClass('fig-' + tag);
            return alu;
        }

        function draw_line(tag, arr, marker_flags)
        {
            if (marker_flags === undefined) {
                marker_flags = 0;
            }

            var line = s.polyline(arr).attr(ATTR_LINE);
            line.addClass('line-' + tag);

            if (marker_flags == 0) {
                return line;
            }

            var arrow = s.polygon([0, 5, 4, 5, 2, 0, 0, 5]).attr({fill: '#E95464'});
            if ((marker_flags & MARKER_R270) != 0) {
                arrow = arrow.transform('r270');
            } else if ((marker_flags & MARKER_R90) != 0) {
                arrow = arrow.transform('r90');
            } else if ((marker_flags & MARKER_R180) != 0) {
                arrow = arrow.transform('r180');
            }

            var marker = arrow.marker(0, 0, 5, 5, 0, 2.5);
            var opt = {};
            if ((marker_flags & MARKER_START) != 0) {
                opt.markerStart = marker;
            } else if ((marker_flags & MARKER_MIDDLE) != 0) {
                opt.markerMid = marker;
            } else {
                opt.markerEnd = marker;
            }
            line.attr(opt);

            return line;
        }

        // Draw registers.
        draw_register('PR', 50, 40);
        draw_register('SP', 50, 40 + 45);
        draw_register('IR', 50, 150);
        for (var i = 0; i < 8; ++i) {
            draw_register('GR ' + i.toString(), 350, 100 + REGISTER_SIZE_Y * (i + 1));
        }
        draw_register('FR', 680, 100);
        draw_alu('ALU', 680, 220);

        draw_register('MAR', 80, 500);
        draw_register('MDR', 80, 550);

        // Connect each block.
        draw_line('mem-pr', [0, 60, 50, 60], MARKER_R270 | MARKER_START);
        draw_line('mem-sp', [0, 105, 50, 105], MARKER_R270 | MARKER_START);
        draw_line('mem-ir', [0, 170, 50, 170], MARKER_R270 | MARKER_START);

        draw_line('mdr-mem', [0, 520, 60, 520], MARKER_R90 | MARKER_END);
        draw_line('mda-mem', [0, 570, 60, 570], MARKER_R90 | MARKER_END);
        draw_line('mem-mdr', [0, 520, 60, 520], MARKER_R270 | MARKER_START);
        draw_line('mem-mda', [0, 570, 60, 570], MARKER_R270 | MARKER_START);

        var gr_common = [175, 190, 175, 300, 300, 300];
        for (var i = 0; i < 8; ++i) {
            var y = 160 + REGISTER_SIZE_Y * i;
            draw_line('ir-gr' + i.toString(), gr_common.concat([300, y, 330, y]), MARKER_R90 | MARKER_END);
        }
        gr_common = [680, 240, 600, 240];
        for (var i = 0; i < 8; ++i) {
            var y = 160 + REGISTER_SIZE_Y * i;
            draw_line('gr' + i.toString() + '-alu-a', gr_common.concat([600, y, 550, y]), MARKER_R270 | MARKER_START);
        }

        gr_common = [680, 360, 600, 360];
        for (var i = 0; i < 8; ++i) {
            var y = 160 + REGISTER_SIZE_Y * i;
            draw_line('gr' + i.toString() + '-alu-b', gr_common.concat([600, y, 550, y]), MARKER_R270 | MARKER_START);
        }

        draw_line('alu-fr', [720, 250, 770, 160], MARKER_R90 | MARKER_END);
        draw_line('ir-alu', [250, 170, 280, 170, 280, 90, 630, 90, 630, 240, 660, 240], MARKER_R90 | MARKER_END);
        draw_line('alu-gr', [750, 300, 800, 300, 800, 500, 475, 500, 475, 482], MARKER_R90 | MARKER_END);
        draw_line('alu-mdr', [750, 300, 800, 300, 800, 500, 350, 500, 350, 570, 301, 570], MARKER_R90 | MARKER_END);
        draw_line('alu-mda', [750, 300, 800, 300, 800, 500, 350, 500, 350, 520, 301, 520], MARKER_R90 | MARKER_END);

        return s;
    }

    function update_register_text(tag, new_text)
    {
        snap.select('.register-text-' + tag).attr({text: new_text});
    }

    function update_machine_states(prev_pr)
    {
        function gen_two_words_str(value)
        {
            return sprintf('0x%04X %04X', (value >> 16) & 0xFFFF, value & 0xFFFF);
        }

        for (var i = 0; i < vm.GR.length; ++i) {
            update_register_text('GR' + i.toString(), gen_two_words_str(vm.GR[i]));
        }

        update_register_text('SP', gen_two_words_str(vm.SP));
        update_register_text('PR', gen_two_words_str(vm.PR));
        update_register_text('FR', sprintf('OF: %d SF: %d ZF: %d', ((vm.FR >> 2) & 0x01), ((vm.FR >> 1) & 0x01), (vm.FR & 0x01)));

        // Set next instruction.
        var word = vm.memory[vm.PR];
        var opcode = (word >> 8) & 0xFF;
        switch (opcode) {
            case 16:
            case 17:
            case 18:
            case 32:
                update_register_text('IR', gen_two_words_str((vm.memory[vm.PR] << 16) | (vm.memory[vm.PR + 1])));
                break;
            default:
                update_register_text('IR', gen_two_words_str(vm.memory[vm.PR]));
                break;
        }

        if ((prev_pr === undefined) || (prev_pr == 0)) {
            // Program is NOT executed.
            return;
        }

        // Set MAR and MDR
        // FIXME:
        word = vm.memory[prev_pr];
        opcode = (word >> 8) & 0xFF;
        switch (opcode) {
            case 0:
                // 0x00 NOP
                break;
            case 16:
                // 0x10 LD r, addr[, x]
                var word = vm.memory[prev_pr];
                var x    = word & 15;
                var r    = word >> 4 & 15;
                var addr = vm.memory[++prev_pr] + (x && vm.GR[x]);
                update_register_text('MAR', gen_two_words_str(addr));
                update_register_text('MDR', gen_two_words_str(vm.memory[addr]));
                break;
            case 17:
                // 0x11 ST r, addr[, x]
                var word = vm.memory[prev_pr];
                var x    = word & 15;
                var r    = word >> 4 & 15;
                var addr = vm.memory[++prev_pr] + (x && vm.GR[x]);
                update_register_text('MAR', gen_two_words_str(addr));
                update_register_text('MDR', gen_two_words_str(vm.memory[addr]));
                break;
            case 18:
                // 0x12 LAD r, addr[, x]
                var word = vm.memory[prev_pr];
                var x    = word & 15;
                var r    = word >> 4 & 15;
                var addr = vm.memory[++prev_pr] + (x && vm.GR[x]);
                update_register_text('MAR', gen_two_words_str(addr));
                break;
            case 20:
                // 0x14 LD, r1, r2
                break;
            case 32:
                // 0x20 ADDA r, addr[, x]
                var word = vm.memory[prev_pr];
                var x = word & 15;
                var r = word >> 4 & 15;
                var addr = vm.memory[++prev_pr] + (x && vm.GR[x]);
                update_register_text('MAR', gen_two_words_str(addr));
                update_register_text('MDR', gen_two_words_str(vm.memory[addr]));
                break;
        }
    }

    function init_button_handlers()
    {
        var on_clear = function()
        {
            assembler = new CaslAssembler();
            vm        = new CometVM({ outputOperation: true });
            program   = null;
            update_machine_states();
        };
        $('#button-clear').on('click', on_clear);

        var on_load = function()
        {
            ast     = assembler.parse(editor.getValue());
            ast     = assembler.expandMacro(ast);
            program = assembler.assemble(ast);

            // Prepare execution.
            vm.load(program.program, 0);
            vm.PR = program.startAddr;

            console.log(program.program);
            update_machine_states();
        };
        $('#button-load').on('click', on_load);

        $('#button-run').on('click', function(){
            if (program == null) {
                on_load();
            }
        });

        $('#button-step').on('click', function(){
            if (program == null) {
                on_load();
            }

            var prev_pr = vm.PR;
            vm.executeStepwise();
            update_machine_states(prev_pr);
        });

        on_clear();
    }

    var resize_timer = false;
    $(window).resize(function() {
        if (resize_timer !== false) {
            clearTimeout(resize_timer);
        }

        resize_timer = setTimeout(resize_diagram, 100);
    });

    // Initialize.
    editor = init_editor();
    snap = init_diagrams();
    init_button_handlers();
    update_machine_states();
    set_background_canvas();
    resize_diagram();
}
