#include <ESP32Servo.h>
#include <SPI.h>
#include <Wire.h>

#define PSX_BUTTON_NUM 16 

// 缓冲区大小定义
#define ACTION_SIZE 512
#define RECV_SIZE 168
#define PRE_CMD_SIZE 128
#define SERVO_NUM 8
#define SERVO_TIME_PERIOD 20

// 存储地址定义
#define INFO_ADDR_SAVE_STR (((8<<10)-4)<<10)
#define BIAS_ADDR_VERIFY 0
#define FLAG_VERIFY 0x38

// 引脚定义
#define PIN_nled 16
#define PIN_beep 11
#define PIN_SDA 5
#define PIN_SCL 4
#define PIN_TX1 17
#define PIN_RX1 18
#define PIN_TX2 42
#define PIN_RX2 41
#define PIN_KEY 36
#define adcPin 12
//#define PIN_Sound 19
//0316
#define PIN_STOP 19      // <--- 确保这里与 EmergencyStop.ino 一致
#define PIN_Touch 8
#define PIN_Infrared 13
#define W25Q64_CS 3	   
#define W25Q64_SCK 9  
#define W25Q64_MOSI 10 
#define W25Q64_MISO 20 
byte servo_pin[SERVO_NUM] = {48, 47, 21, 14, 39, 40};

#define nled_on() digitalWrite(PIN_nled, LOW)
#define nled_off() digitalWrite(PIN_nled, HIGH)
#define beep_on() tone(PIN_beep,1000,100);
#define beep_off() noTone(PIN_beep);

#define W25X_JEDEC_ID 0x9F	   
#define W25X_READ 0x03		   
#define W25X_PAGE_PROG 0x02	   
#define W25X_SECTOR_ERASE 0x20 
#define W25X_WRITE_ENABLE 0x06 
#define W25X_READ_STATUS 0x05  
#define W25X_STATUS_BUSY 0x01  

typedef struct {
  long myversion;
  long dj_record_num;
  char pre_cmd[PRE_CMD_SIZE + 1];
  int  dj_bias_pwm[SERVO_NUM+1];
} eeprom_info_t;

eeprom_info_t eeprom_info;

typedef struct {
    unsigned int aim = 1500;
    float cur = 1500.0;
    unsigned int time1 = 1000;
    float inc = 0.0;
} duoji_struct;

Servo myservo[SERVO_NUM];
char uart_receive_buf[ACTION_SIZE];
String uart_receive_str, uart_receive_str_bak;
byte uart_get_ok, uart_mode;
char cmd_return[ACTION_SIZE];
int uart_receive_str_len;
int zx_read_id, zx_read_flag, zx_read_value;
byte flag_sync;
duoji_struct servo_do[SERVO_NUM];

int do_start_index;
int do_group_cnt;         
int group_num_start;      
int group_num_end;        
int group_num_cnt;

uint8_t group_do_ok= 1;
uint32_t action_time = 0; 

void setup_nled();
void setup_uart();
void setup_beep();
void setup_w25q();
void setup_servo();
void setup_start();

void w25x_init(void);
void w25x_wait_busy(void);
void w25x_write_enable(void);
uint32_t w25x_readId(void);
void w25x_read(uint8_t *buf, uint32_t addr, uint32_t len);
void w25x_write(uint8_t *buf, uint32_t addr, uint32_t len);
void read_eeprom(void);
void rewrite_eeprom(void);
void save_action(char *str);

void loop_nled();
void loop_servo();
void loop_uart();
void loop_action();

void parse_cmd(char *uart_receive_buf);
void uart_data_parse(char sbuf_bak);
void parse_action(char *uart_receive_buf);
void do_group_once(int index);
void set_servo(int mindex, int mpwm, int mtime);
void handleSerial2(void);
void handleSerial1(void);
void all_uart_send_str(char *str);
int read_servo_pwm(uint8_t idx, uint32_t timeout_ms = 50);
void stream_servo_positions_to_pc();
void loop_teach_record();

void serialEvent();

//0316 声明急停模块函数
extern void setup_emergency_stop();
extern void loop_emergency_stop();

#define US01_ADDR 0x2D  
#define REG_R_RED    0x00
#define REG_R_GREEN  0x01
#define REG_R_BLUE   0x02
#define REG_T_RED    0x03
#define REG_T_GREEN  0x04
#define REG_T_BLUE   0x05

#define COLOR_RED     {255, 0, 0}
#define COLOR_GREEN   {0, 255, 0}
#define COLOR_BLUE    {0, 0, 255}
#define COLOR_YELLOW  {255, 255, 0}
#define COLOR_PURPLE  {255, 0, 255}
#define COLOR_CYAN    {0, 255, 255}
#define COLOR_WHITE   {255, 255, 255}
#define COLOR_OFF     {0, 0, 0}

#define COLOR_COUNT (sizeof(color_table) / sizeof(color_table[0]))

volatile int Systick_ms_battery;
volatile int Systick_ms_dingju;
volatile int Systick_ms_yanse;
volatile int System_RecordTime;
volatile int max_color;
volatile int ai_mode;
volatile int color_num;

#define pi 3.1415926
typedef struct {
	float L0;
	float L1;
	float L2;
	float L3;

	float servo_angle[6];	
	float servo_range[6];	
	int servo_pwm[6];		
}kinematics_t;

kinematics_t kinematics;

void setup_kinematics(float L0, float L1, float L2, float L3, kinematics_t *kinematics) {
	kinematics->L0 = L0*10;
	kinematics->L1 = L1*10;
	kinematics->L2 = L2*10;
	kinematics->L3 = L3*10;
}

int kinematics_analysis(float x, float y, float z, float Alpha, kinematics_t *kinematics) {
	float theta3, theta4, theta5, theta6;
	float l0, l1, l2, l3;
	float aaa, bbb, ccc, zf_flag;

	x = x*10;
	y = y*10;
	z = z*10;
	l0 = kinematics->L0;
	l1 = kinematics->L1;
	l2 = kinematics->L2;
	l3 = kinematics->L3;

	if(x == 0) {
		theta6 = 0.0;
	} else {
		theta6 = atan(x/y)*180.0/pi;
	}

	y = sqrt(x*x + y*y);
	y = y-l3 * cos(Alpha*pi/180.0);
	z = z-l0-l3*sin(Alpha*pi/180.0);

	if(z < -l0) {
		return 1;
	}
	if(sqrt(y*y + z*z) > (l1+l2)) {
		return 2;
	}

	ccc = acos(y / sqrt(y * y + z * z));
	bbb = (y*y+z*z+l1*l1-l2*l2)/(2*l1*sqrt(y*y+z*z));
	if(bbb > 1 || bbb < -1) {
		return 3;
	}
	if (z < 0) {
		zf_flag = -1;
	} else {
		zf_flag = 1;
	}
	theta5 = ccc * zf_flag + acos(bbb);
	theta5 = theta5 * 180.0 / pi;
	if(theta5 > 180.0 || theta5 < 0.0) {
		return 4;
	}

	aaa = -(y*y+z*z-l1*l1-l2*l2)/(2*l1*l2);
	if (aaa > 1 || aaa < -1) {
		return 5;
	}
	theta4 = acos(aaa);
	theta4 = 180.0 - theta4 * 180.0 / pi ;
	if (theta4 > 135.0 || theta4 < -135.0) {
		return 6;
	}

	theta3 = Alpha - theta5 + theta4;
	if(theta3 > 90.0 || theta3 < -90.0) {
		return 7;
	}

	kinematics->servo_angle[0] = theta6;
	kinematics->servo_angle[1] = theta5-90;
	kinematics->servo_angle[2] = theta4;
	kinematics->servo_angle[3] = theta3;

	kinematics->servo_pwm[0] = (int)(1500-2000.0 * kinematics->servo_angle[0] / 270.0);
	kinematics->servo_pwm[1] = (int)(1500+2000.0 * kinematics->servo_angle[1] / 270.0);
	kinematics->servo_pwm[2] = (int)(1500+2000.0 * kinematics->servo_angle[2] / 270.0);
	kinematics->servo_pwm[3] = (int)(1500+2000.0 * kinematics->servo_angle[3] / 270.0);

	return 0;
}

int kinematics_move(float x, float y, float z, int mtime) {
	int i,j, mmin = 0, flag = 0;
	if(y < 0)return 0;
	flag = 0;
	for(i=0;i>=-135;i--) {
		if(0 == kinematics_analysis(x,y,z,i,&kinematics)){
			if(i<mmin)mmin = i;
			flag = 1;
		}
	}

	if(flag) {
		kinematics_analysis(x,y,z,mmin,&kinematics);
		for(j=0;j<4;j++) {
			set_servo(j, kinematics.servo_pwm[j], mtime);
		}
		return 1;
	}
	return 0;
}

typedef struct {
	uint8_t r;
	uint8_t g;
	uint8_t b;
} Color_t;

const Color_t color_table[] = {
	COLOR_RED, COLOR_GREEN, COLOR_BLUE, COLOR_YELLOW,
	COLOR_PURPLE, COLOR_CYAN, COLOR_WHITE, COLOR_OFF
};

bool US01_Init(void);
bool us01_rgb_r(uint8_t r, uint8_t g, uint8_t b);
bool us01_rgb_t(uint8_t r, uint8_t g, uint8_t b);
bool us01_rgb_both(Color_t color);
void us01_set_color(uint8_t index);

#define LTR381_I2C_ADDR 0x53
#define LTR381_MAIN_CTRL 0x00
#define LTR381_MEAS_RATE 0x04
#define LTR381_GAIN 0x05
#define LTR381_PART_ID 0x06
#define LTR381_MAIN_STATUS 0x07
#define LTR381_INT_CFG 0x19

#define LTR381_IR_DATA_0 0x0A
#define LTR381_GREEN_DATA_0 0x0D
#define LTR381_RED_DATA_0 0x10
#define LTR381_BLUE_DATA_0 0x13

#define LTR381_MODE_ALS 0x02
#define LTR381_MODE_RGB 0x06

#define LTR381_GAIN_1X 0x00
#define LTR381_GAIN_3X 0x01
#define LTR381_GAIN_6X 0x02
#define LTR381_GAIN_9X 0x03
#define LTR381_GAIN_18X 0x04

#define LTR381_RESOLUTION_25MS 0x00
#define LTR381_RESOLUTION_50MS 0x41
#define LTR381_RESOLUTION_100MS 0x22

typedef struct {
	uint8_t mode;
	uint8_t gain;
	uint8_t resolution;
} LTR381_HandleTypeDef;

LTR381_HandleTypeDef ltr381;

void LTR381_Init(void);
uint8_t LTR381_Config(LTR381_HandleTypeDef *hltr, uint8_t mode, uint8_t gain, uint8_t resolution);
uint8_t LTR381_ReadALS_IR(LTR381_HandleTypeDef *hltr, uint32_t *als_data, uint32_t *ir_data);
uint8_t LTR381_ReadRGB_IR(LTR381_HandleTypeDef *hltr, uint32_t *red, uint32_t *green, uint32_t *blue, uint32_t *ir);
void LTR381_LED_ON(void);
void LTR381_LED_OFF(void);
void LTR381_CalibrateRGB(uint32_t raw_r, uint32_t raw_g, uint32_t raw_b, uint32_t raw_ir,
                         uint32_t *calib_r, uint32_t *calib_g, uint32_t *calib_b);
float LTR381_GetLux_Calibrated(LTR381_HandleTypeDef *hltr, uint32_t raw_als, uint32_t raw_ir);
uint8_t LTR381_ReadALS(LTR381_HandleTypeDef *hltr, uint32_t *als_data);
uint8_t LTR381_ReadRGB(LTR381_HandleTypeDef *hltr, uint32_t *red, uint32_t *green, uint32_t *blue);


uint8_t ps2_buf[9];
uint16_t ps2_cmd = 0xffff;
uint16_t ps2_cmd_last = 0xffff;

void update_button_states() {
	ps2_cmd = (ps2_buf[6] & 0x04) ? ps2_cmd & ~0x0001 : ps2_cmd | 0x0001;
	ps2_cmd = (ps2_buf[6] & 0x08) ? ps2_cmd & ~0x0002 : ps2_cmd | 0x0002;
	ps2_cmd = (ps2_buf[6] & 0x01) ? ps2_cmd & ~0x0004 : ps2_cmd | 0x0004;
	ps2_cmd = (ps2_buf[6] & 0x02) ? ps2_cmd & ~0x0008 : ps2_cmd | 0x0008;

	ps2_cmd = (ps2_buf[5] & 0x10) ? ps2_cmd & ~0x0010 : ps2_cmd | 0x0010;
	ps2_cmd = (ps2_buf[5] & 0x20) ? ps2_cmd & ~0x0020 : ps2_cmd | 0x0020;
	ps2_cmd = (ps2_buf[5] & 0x40) ? ps2_cmd & ~0x0040 : ps2_cmd | 0x0040;
	ps2_cmd = (ps2_buf[5] & 0x80) ? ps2_cmd & ~0x0080 : ps2_cmd | 0x0080;

	ps2_cmd = (ps2_buf[5] == 0x00) ? ps2_cmd & ~0x1000 : ps2_cmd | 0x1000;
	ps2_cmd = (ps2_buf[5] == 0x02) ? ps2_cmd & ~0x2000 : ps2_cmd | 0x2000;
	ps2_cmd = (ps2_buf[5] == 0x04) ? ps2_cmd & ~0x4000 : ps2_cmd | 0x4000;
	ps2_cmd = (ps2_buf[5] == 0x06) ? ps2_cmd & ~0x8000 : ps2_cmd | 0x8000;

	ps2_cmd = (ps2_buf[6] & 0x10) ? ps2_cmd & ~0x0100 : ps2_cmd | 0x0100;
	ps2_cmd = (ps2_buf[6] & 0x40) ? ps2_cmd & ~0x0200 : ps2_cmd | 0x0200;
	ps2_cmd = (ps2_buf[6] & 0x80) ? ps2_cmd & ~0x0400 : ps2_cmd | 0x0400;
	ps2_cmd = (ps2_buf[6] & 0x20) ? ps2_cmd & ~0x0800 : ps2_cmd | 0x0800;
  }

void loop_ps2() {
	uint8_t i = 0;
	static uint32_t systick_ms_bak = 0;
	if (millis() - systick_ms_bak < 50) return;
	systick_ms_bak = millis();

    uint8_t bytes_read = Wire.requestFrom(0x50, 9);
    if (bytes_read == 0) return;

	i = 0;
	while (Wire.available() && i < 9) {
	  ps2_buf[i] = Wire.read();
	  i++;
    }

	if (ps2_buf[0] == 0x01 && ps2_buf[8] == 0x05) {
	  update_button_states();
    }
}

int getMaxTime(char *str) {
    int max_time = 0;
    int tmp_time = 0;
    for (int i = 0; str[i]; i++) {
        if (str[i] == 'T') {
            tmp_time = (str[i + 1] - '0') * 1000 +
                      (str[i + 2] - '0') * 100 +
                      (str[i + 3] - '0') * 10 +
                      (str[i + 4] - '0');
            if (tmp_time > max_time) {
                max_time = tmp_time;
            }
            i += 4;
            continue;
        }
    }
    return max_time;
}

void setup_nled() {
    pinMode(PIN_nled, OUTPUT);
    nled_off();
}

void setup_beep() {
    pinMode(PIN_beep, OUTPUT);
    beep_off();
}

void setup_uart()
{
    Serial.begin(115200);
    Serial1.begin(115200, SERIAL_8N1, PIN_RX1, PIN_TX1); 
    Serial2.begin(115200, SERIAL_8N1, PIN_RX2, PIN_TX2);

    Serial1.onReceive(handleSerial1); 
    Serial2.onReceive(handleSerial2);

    Serial.println("uart init...");
}

void setup_w25q() {
	w25x_init(); 
	uint32_t jedec_id = w25x_readId();
	Serial.print("W25Q64 ID: 0x");
    Serial.println(jedec_id, HEX); 
}

void setup_servo() {
  	for (byte i = 0; i < SERVO_NUM; i++) {
        myservo[i].attach(servo_pin[i]);
        myservo[i].writeMicroseconds(servo_do[i].aim);
    }
	read_eeprom();
	if (eeprom_info.pre_cmd[PRE_CMD_SIZE] != FLAG_VERIFY) {
        for (int i = 0; i < SERVO_NUM; i++) {
            servo_do[i].aim = servo_do[i].cur = 1500 + eeprom_info.dj_bias_pwm[i];
            servo_do[i].inc = 0;
        }
    }
	if (eeprom_info.pre_cmd[PRE_CMD_SIZE] == FLAG_VERIFY)
    {
        if (eeprom_info.pre_cmd[0] == '$')
        {
            parse_cmd(eeprom_info.pre_cmd);
        }
    }
}

void setup_start()
{
    if (eeprom_info.pre_cmd[PRE_CMD_SIZE] == FLAG_VERIFY)
    {
        parse_cmd(eeprom_info.pre_cmd);
    }
}

void w25x_init()
{
	pinMode(W25Q64_CS, OUTPUT);
	digitalWrite(W25Q64_CS, HIGH); 

	SPI.begin(W25Q64_SCK, W25Q64_MISO, W25Q64_MOSI);
	SPI.setDataMode(SPI_MODE0);
	SPI.setFrequency(2000000);
}

void w25x_wait_busy()
{
	digitalWrite(W25Q64_CS, LOW);
	SPI.transfer(W25X_READ_STATUS); 
	while (SPI.transfer(0xFF) & W25X_STATUS_BUSY);
	digitalWrite(W25Q64_CS, HIGH);
}

void w25x_write_enable()
{
	digitalWrite(W25Q64_CS, LOW);
	SPI.transfer(W25X_WRITE_ENABLE);
	digitalWrite(W25Q64_CS, HIGH);
	delayMicroseconds(1); 
}

uint32_t w25x_readId()
{
	uint32_t id = 0;
	digitalWrite(W25Q64_CS, LOW);
	SPI.transfer(W25X_JEDEC_ID);
	id |= (uint32_t)SPI.transfer(0xFF) << 16; 
	id |= (uint32_t)SPI.transfer(0xFF) << 8;  
	id |= (uint32_t)SPI.transfer(0xFF);		  
	digitalWrite(W25Q64_CS, HIGH);
    return id;
}

void w25x_read(uint8_t *buf, uint32_t addr, uint32_t len)
{
	if (buf == NULL || len == 0) return;

	digitalWrite(W25Q64_CS, LOW);
	SPI.transfer(W25X_READ);
	SPI.transfer((addr >> 16) & 0xFF);
	SPI.transfer((addr >> 8) & 0xFF);
	SPI.transfer(addr & 0xFF);
	for (uint32_t i = 0; i < len; i++)
	{
		buf[i] = SPI.transfer(0xFF);
	}
	digitalWrite(W25Q64_CS, HIGH);
}

void w25x_erase_sector(uint32_t addr)
{
	addr <<= 12;
    w25x_write_enable(); 
	digitalWrite(W25Q64_CS, LOW);
	SPI.transfer(W25X_SECTOR_ERASE); 
	SPI.transfer((addr >> 16) & 0xFF);
    SPI.transfer((addr >> 8) & 0xFF);
	SPI.transfer(addr & 0xFF);
	digitalWrite(W25Q64_CS, HIGH);
	w25x_wait_busy();
}


void w25x_write(uint8_t *buf, uint32_t addr, uint32_t len)
{
	if (buf == NULL || len == 0) return;
    uint32_t page_size = 256;						   
	uint32_t offset = addr % page_size;				   
	uint32_t write_len = min(len, page_size - offset);

	while (len > 0)
	{
		w25x_write_enable(); 
		digitalWrite(W25Q64_CS, LOW);
		SPI.transfer(W25X_PAGE_PROG); 
		SPI.transfer((addr >> 16) & 0xFF);
        SPI.transfer((addr >> 8) & 0xFF);
		SPI.transfer(addr & 0xFF);
		for (uint32_t i = 0; i < write_len; i++)
		{
			SPI.transfer(buf[i]);
		}
		digitalWrite(W25Q64_CS, HIGH);
        w25x_wait_busy(); 

		len -= write_len;
		addr += write_len;
		buf += write_len;
		write_len = min(len, page_size);
	}
}

void rewrite_eeprom(void)
{
    w25x_erase_sector(INFO_ADDR_SAVE_STR / 4096);
    w25x_write((uint8_t*)(&eeprom_info), INFO_ADDR_SAVE_STR, sizeof(eeprom_info_t));
}

void read_eeprom(void)
{
    w25x_read((uint8_t*)(&eeprom_info), INFO_ADDR_SAVE_STR, sizeof(eeprom_info_t));
}

void save_action(char *str) {
    int32_t action_index = -1;
    if (str[1] == '$' && str[2] == '!') 
    {
        eeprom_info.pre_cmd[PRE_CMD_SIZE] = 0;
        rewrite_eeprom();
        all_uart_send_str("@CLEAR PRE_CMD OK!");
        return;
    }
    else if (str[1] == '$') 
    {
        memset(eeprom_info.pre_cmd, 0, sizeof(eeprom_info.pre_cmd));
        strcpy(eeprom_info.pre_cmd, str + 1);        
        eeprom_info.pre_cmd[strlen(str) - 2] = ' ';
        eeprom_info.pre_cmd[PRE_CMD_SIZE] = FLAG_VERIFY;
        rewrite_eeprom();
        all_uart_send_str("@SET PRE_CMD OK!");
        all_uart_send_str(eeprom_info.pre_cmd);
        return;
    }

    action_index = (str[2] - '0') * 1000 + (str[3] - '0') * 100 + (str[4] - '0') * 10 + (str[5] - '0');
    if ((action_index < 0) || str[6] != '#')
    {
        all_uart_send_str("E");
        return;
    }

    if ((action_index * ACTION_SIZE % 4096) == 0)
    {
        w25x_erase_sector(action_index * ACTION_SIZE / 4096);
    }
    int len = strlen((char *)str);
    str[0] = '{';
    str[len - 1] = '}';

    w25x_write((uint8_t *)str, action_index * ACTION_SIZE, strlen(str) + 1);
    all_uart_send_str("A");
    return;
}

void loop_nled() {
    static bool led_state = false;
    static unsigned long last_update = 0;
    if (millis() - last_update > 500) {
        last_update = millis();
        led_state ?
        nled_on() : nled_off();
        led_state = !led_state;
    }
}

void loop_servo() {
    static unsigned long last_update = 0;
    if (millis() - last_update > SERVO_TIME_PERIOD) {
        last_update = millis();
        for (byte i = 0; i < SERVO_NUM; i++) {
            if (servo_do[i].inc) {
                if (abs(servo_do[i].aim - servo_do[i].cur) <= abs(servo_do[i].inc)) {
                    myservo[i].writeMicroseconds(servo_do[i].aim);
                    servo_do[i].cur = servo_do[i].aim;
                    servo_do[i].inc = 0;
                } else {
                    servo_do[i].cur += servo_do[i].inc;
                    myservo[i].writeMicroseconds((int)servo_do[i].cur);
                }
            }
        }
    }
}

void loop_uart() {
    if (uart_get_ok) {
        switch (uart_mode) {
            case 1: parse_cmd(uart_receive_buf);
            break;
            case 2:
            case 3: parse_action(uart_receive_buf); break;
            case 4: save_action(uart_receive_buf); break;
        }

        uart_get_ok = false;
        uart_mode = 0;
        uart_receive_str = "";
    }
}

void handleSerial1()
{
    while (Serial1.available() > 0)
    {
        char sbuf_bak = ((char)(Serial1.read()));
        uart_data_parse(sbuf_bak);
    }
}

void handleSerial2()
{
    while (Serial2.available() > 0)
    {
        char sbuf_bak = Serial2.read();
        uart_data_parse(sbuf_bak);
    }
}

void all_uart_send_str(char *str)
{
    Serial.print(str);
    Serial1.print(str);
    Serial2.print(str);
}

void parse_action(char *uart_receive_buf) {
    static unsigned int index, time1, pwm1, pwm2, i, len;

    all_uart_send_str(uart_receive_buf);
    
    // 回读处理
    if (zx_read_flag) {
        if ((uart_receive_buf[0] == '#') && (uart_receive_buf[4] == 'P') && (uart_receive_buf[9] == '!')) {
            index = (uart_receive_buf[1] - '0') * 100 +
                   (uart_receive_buf[2] - '0') * 10 +
                   (uart_receive_buf[3] - '0');
            if (index == zx_read_id) {
                zx_read_flag = 0;
                zx_read_value = (uart_receive_buf[5] - '0') * 1000 +
                               (uart_receive_buf[6] - '0') * 100 +
                               (uart_receive_buf[7] - '0') * 10 +
                               (uart_receive_buf[8] - '0');
            }
        }
    }
    // 偏差处理
    else if ((uart_receive_buf[0] == '#') && (uart_receive_buf[4] == 'P') &&
             (uart_receive_buf[5] == 'S') && (uart_receive_buf[6] == 'C') &&
             (uart_receive_buf[7] == 'K')) {
        index = (uart_receive_buf[1] - '0') * 100 +
               (uart_receive_buf[2] - '0') * 10 +
               (uart_receive_buf[3] - '0');
        if (index < SERVO_NUM) {
            int bias_tmp = (uart_receive_buf[9] - '0') * 100 +
                          (uart_receive_buf[10] - '0') * 10 +
                          (uart_receive_buf[11] - '0');
            if (bias_tmp < 127) {
                if (uart_receive_buf[8] == '+') {
                    servo_do[index].cur = 1500 + bias_tmp;
                    eeprom_info.dj_bias_pwm[index] = bias_tmp;
                } else if (uart_receive_buf[8] == '-') {
                    servo_do[index].cur = 1500 - bias_tmp;
                    eeprom_info.dj_bias_pwm[index] = -bias_tmp;
                }
                myservo[index].writeMicroseconds(servo_do[index].cur);
                rewrite_eeprom();
            }
        }
    }
    // 停止处理
    else if ((uart_receive_buf[0] == '#') && (uart_receive_buf[4] == 'P') &&
             (uart_receive_buf[5] == 'D') && (uart_receive_buf[6] == 'S') &&
             (uart_receive_buf[7] == 'T')) {
        index = (uart_receive_buf[1] - '0') * 100 +
               (uart_receive_buf[2] - '0') * 10 +
               (uart_receive_buf[3] - '0');
        if (index < SERVO_NUM) {
            servo_do[index].inc = 0.001f;
            servo_do[index].aim = servo_do[index].cur;
        }
    }
    // 动作指令解析
    else if ((uart_receive_buf[0] == '#') || (uart_receive_buf[0] == '{')) {
        len = strlen(uart_receive_buf);
        index = pwm1 = time1 = 0;

        for (i = 0; i < len; i++) {
            if (uart_receive_buf[i] == '#') {
                i++;
                while ((uart_receive_buf[i] != 'P') && (i < len)) {
                    index = index * 10 + (uart_receive_buf[i] - '0');
                    i++;
                }
                i--;
            } else if (uart_receive_buf[i] == 'P') {
                i++;
                while ((uart_receive_buf[i] != 'T') && (i < len)) {
                    pwm1 = pwm1 * 10 + (uart_receive_buf[i] - '0');
                    i++;
                }
                i--;
            } else if (uart_receive_buf[i] == 'T') {
                i++;
                while ((uart_receive_buf[i] != '!') && (i < len)) {
                    time1 = time1 * 10 + (uart_receive_buf[i] - '0');
                    i++;
                }

                if (time1 < SERVO_TIME_PERIOD) time1 = SERVO_TIME_PERIOD;
                // 全舵机控制
                if ((index == 255) && (pwm1 >= 500) && (pwm1 <= 2500) && (time1 < 10000)) {
                    for (int j = 0; j < SERVO_NUM; j++) {
                        pwm2 = pwm1 + eeprom_info.dj_bias_pwm[j];
                        if (pwm2 > 2500) pwm2 = 2500;
                        if (pwm2 < 500) pwm2 = 500;

                        servo_do[j].aim = pwm2;
                        servo_do[j].time1 = time1;
                        float pwm_err = servo_do[j].aim - servo_do[j].cur;
                        servo_do[j].inc = (pwm_err * 1.00f) / (time1 / SERVO_TIME_PERIOD);
                    }
                }
                // 无效参数检查
                else if ((index >= SERVO_NUM) || (pwm1 > 2500) || (pwm1 < 500) || (time1 > 10000)) {
             
                }
                // 单个舵机控制
                else {
                    servo_do[index].aim = pwm1 + eeprom_info.dj_bias_pwm[index];
                    if (servo_do[index].aim > 2500) servo_do[index].aim = 2500;
                    if (servo_do[index].aim < 500) servo_do[index].aim = 500;

                    servo_do[index].time1 = time1;
                    float pwm_err = servo_do[index].aim - servo_do[index].cur;
                    servo_do[index].inc = (pwm_err * 1.00f) / (time1 / SERVO_TIME_PERIOD);
                }

                index = pwm1 = time1 = 0;
            }
        }
    }
}

void parse_cmd(char *cmd)
{
    int index = 0, int1 = 0, int2 = 0, int3 = 0, int4 = 0;
    String cmdStr = String(cmd);
    Serial.println(cmd);
    if (cmdStr.indexOf("$RST!") != -1)
    {
        ESP.restart();
    }
    else if (cmdStr.indexOf("$DGT:") != -1)
    {
        if (sscanf((char *)cmd, "$DGT:%d-%d,%d!", &group_num_start, &group_num_end, &group_num_cnt))
        {
            group_do_ok = 1;
            if (group_num_start != group_num_end)
            {
                do_start_index = group_num_start;
                do_group_cnt = group_num_cnt;
                group_do_ok = 0;
            }
            else
            {
                do_group_once(group_num_start);
            }
        }
    }
    else if (cmdStr.indexOf("$DST!") != -1)
    {
        group_do_ok = 1;
        parse_action("#255PDST!"); 
    }
    else if (cmdStr.indexOf("$DST:") != -1)
    {
        if (sscanf((char *)cmd, "$DST:%d!", &index))
        {
            sprintf((char *)cmd_return, "#%03dPDST!", (int)index);
            parse_action(cmd_return);
        }
    }
    else if (cmdStr.indexOf("$DGS:") != -1)
    {
        if (sscanf((char *)cmd, "$DGS:%d!", &int1))
        {
            group_do_ok = 1;
            do_group_once(int1);
        }
    }
     else if (cmdStr.indexOf("$KMS:") != -1)
{
    if (sscanf((char *)uart_receive_buf, "$KMS:%d,%d,%d,%d!", &int1, &int2, &int3, &int4))
    {
        if (kinematics_move(int1, int2, int3, int4))
        {
        }
        else
        {
            Serial.println("Can not find best pos!!!");
        }
    }
}
}

void loop_action()
{
	static long long systick_ms_bak = 0;
	if (group_do_ok == 0)
	{
		if (millis() - systick_ms_bak > action_time)
		{
			systick_ms_bak = millis();
			if (group_num_cnt != 0 && do_group_cnt == 0)
			{
				group_do_ok = 1;
				all_uart_send_str("@GroupDone!");
				return;
			}
			do_group_once(do_start_index);
			if (group_num_start < group_num_end)
			{
				if (do_start_index == group_num_end)
				{
					do_start_index = group_num_start;
					if (group_num_cnt != 0)
					{
						do_group_cnt--;
					}
					return;
				}
				do_start_index++;
			}
			else
			{
				if (do_start_index == group_num_end)
				{
					do_start_index = group_num_start;
					if (group_num_cnt != 0)
					{
						do_group_cnt--;
					}
					return;
				}
				do_start_index--;
			}
		}
	}
}


void do_group_once(int group_num)
{
	memset(cmd_return, 0, sizeof(cmd_return));
	w25x_read((uint8_t *)cmd_return, group_num * ACTION_SIZE, ACTION_SIZE);
	action_time = getMaxTime(cmd_return);

	parse_action(cmd_return);
}

void serialEvent() {
	while (Serial.available()) {
		char received_char = (char)Serial.read();
		uart_data_parse(received_char);
	}
}

void uart_data_parse(char received_char) {
	static int uart_receive_buf_index = 0;

	if (uart_get_ok) return;
	if (uart_mode == 0) {
		switch (received_char) {
			case '$': uart_mode = 1; break;  
			case '#': uart_mode = 2; break;
			case '{': uart_mode = 3; break;  
			case '<': uart_mode = 4; break;  
			default: return;
		}
		uart_receive_str = "";
		uart_receive_buf_index = 0;
	}

	if (uart_receive_buf_index < ACTION_SIZE - 1) {
		uart_receive_buf[uart_receive_buf_index++] = received_char;
	}
	uart_receive_str += received_char;
	bool is_end_char = false;
	switch (uart_mode) {
		case 1: is_end_char = (received_char == '!'); break;
        case 2: is_end_char = (received_char == '!'); break;
		case 3: is_end_char = (received_char == '}'); break;
		case 4: is_end_char = (received_char == '>'); break;
	}

	if (is_end_char) {
		uart_receive_buf[uart_receive_buf_index] = '\0';
		uart_get_ok = true;
		if(uart_mode == 1) uart_receive_str_bak = uart_receive_str;
		uart_receive_buf_index = 0;  
	}
}

void set_servo(int servo_index, int pwm_value, int move_time) {
	servo_do[servo_index].aim = pwm_value;
	servo_do[servo_index].time1 = move_time;
	servo_do[servo_index].inc = (servo_do[servo_index].aim - servo_do[servo_index].cur) / (move_time / 20.0f);

	snprintf(cmd_return, sizeof(cmd_return), "#%03dP%04dT%04d! ", servo_index, pwm_value, move_time);

	all_uart_send_str(cmd_return); 
}

// ==========================================
// 【核心修复区】：增强型底层读取函数
// ==========================================
int read_servo_pwm(uint8_t idx, uint32_t timeout_ms) {
  if (idx >= SERVO_NUM) return -1;
  
  // 【修复 1】请求数据前，强制清空接收状态，丢弃上一轮的残留或冲突数据
  uart_get_ok = false;
  uart_mode = 0;
  uart_receive_str = "";
  memset(uart_receive_buf, 0, ACTION_SIZE);

  zx_read_id = idx;
  zx_read_flag = 1;
  zx_read_value = 0;

  char cmd[16];
  snprintf(cmd, sizeof(cmd), "#%03dPRAD!", idx);

  // 只发到舵机所在总线，防止污染 PC 端 Serial
  Serial1.print(cmd);
  
  uint32_t t0 = millis();
  while (zx_read_flag && (millis() - t0 < timeout_ms)) {
    loop_uart();
    delay(1);
  }

  if (zx_read_flag) {
    zx_read_flag = 0;
    return -1;
  }
  return zx_read_value;
}

void stream_servo_positions_to_pc() {
  static uint32_t last = 0;
  if (millis() - last < 200) return;
  last = millis();

  Serial.print("POS:");
  for (int i = 0; i < 6; i++) {
    int pwm = read_servo_pwm(i, 80);
    Serial.print(i);
    Serial.print("=");
    Serial.print(pwm);
    if (i != 5) Serial.print(",");
  }
  Serial.println();
}


void LTR381_Init(void) {
    Wire.begin(PIN_SDA, PIN_SCL);
    LTR381_ReadReg(LTR381_PART_ID);
}

static uint8_t LTR381_ReadReg(uint8_t reg) {
    Wire.beginTransmission(LTR381_I2C_ADDR);
    Wire.write(reg);
    if (Wire.endTransmission(false) != 0) {
      return 0;
    }

    Wire.requestFrom(LTR381_I2C_ADDR, 1);
    if (Wire.available()) {
      return Wire.read();
    }
    return 0;
}

static uint8_t LTR381_WriteReg(uint8_t reg, uint8_t value) {
    Wire.beginTransmission(LTR381_I2C_ADDR);
    Wire.write(reg);
    Wire.write(value);
    if (Wire.endTransmission() != 0) {
      return 0;
    }
    return 1;
}

static uint8_t LTR381_ReadMultiReg(uint8_t reg, uint8_t *buf, uint8_t len) {
    Wire.beginTransmission(LTR381_I2C_ADDR);
    Wire.write(reg);
    if (Wire.endTransmission(false) != 0) {
      return 0;
    }

    Wire.requestFrom(LTR381_I2C_ADDR, len);
    for (uint8_t i = 0; i < len; i++) {
      if (Wire.available()) {
        buf[i] = Wire.read();
      } else {
        return 0;
      }
    }
    return 1;
}

uint8_t LTR381_Config(LTR381_HandleTypeDef *hltr, uint8_t mode, uint8_t gain, uint8_t resolution) {
    if (LTR381_WriteReg(LTR381_MAIN_CTRL, mode) != 1) return 0;
    if (LTR381_WriteReg(LTR381_GAIN, gain) != 1) return 0;
    if (LTR381_WriteReg(LTR381_MEAS_RATE, resolution) != 1) return 0;

    hltr->mode = mode;
    hltr->gain = gain;
    hltr->resolution = resolution;

    delay(10);
    return 1;
}

uint8_t LTR381_ReadALS(LTR381_HandleTypeDef *hltr, uint32_t *als_data) {
    uint8_t raw_als[3];
    if (hltr->mode != LTR381_MODE_ALS) {
      if (LTR381_Config(hltr, LTR381_MODE_ALS, hltr->gain, hltr->resolution) != 1) return 0;
      delay(10);
    }
    if (LTR381_ReadMultiReg(LTR381_GREEN_DATA_0, raw_als, 3) != 1) return 0;

    *als_data = ((uint32_t)raw_als[2] << 16) | ((uint32_t)raw_als[1] << 8) | raw_als[0];
    return 1;
}

uint8_t LTR381_ReadALS_IR(LTR381_HandleTypeDef *hltr, uint32_t *als_data, uint32_t *ir_data) {
    uint8_t raw_data[3];
    if (hltr->mode != LTR381_MODE_ALS) {
      if (LTR381_Config(hltr, LTR381_MODE_ALS, hltr->gain, hltr->resolution) != 1) return 0;
      delay(10);
    }

    if (LTR381_ReadMultiReg(LTR381_GREEN_DATA_0, raw_data, 3) != 1) return 0;
    *als_data = ((uint32_t)raw_data[2] << 16) | ((uint32_t)raw_data[1] << 8) | raw_data[0];
    if (LTR381_ReadMultiReg(LTR381_IR_DATA_0, raw_data, 3) != 1) return 0;
    *ir_data = ((uint32_t)raw_data[2] << 16) | ((uint32_t)raw_data[1] << 8) | raw_data[0];

    return 1;
}

uint8_t LTR381_ReadRGB(LTR381_HandleTypeDef *hltr, uint32_t *red, uint32_t *green, uint32_t *blue) {
    uint8_t raw_data[9];
    if (hltr->mode != LTR381_MODE_RGB) {
      if (LTR381_Config(hltr, LTR381_MODE_RGB, hltr->gain, hltr->resolution) != 1) return 0;
      delay(10);
    }

    if (LTR381_ReadMultiReg(LTR381_GREEN_DATA_0, raw_data, 9) != 1) return 0;

    *green = ((uint32_t)raw_data[2] << 16) | ((uint32_t)raw_data[1] << 8) | raw_data[0];
    *red = ((uint32_t)raw_data[5] << 16) | ((uint32_t)raw_data[4] << 8) | raw_data[3];
    *blue = ((uint32_t)raw_data[8] << 16) | ((uint32_t)raw_data[7] << 8) | raw_data[6];

    return 1;
}

uint8_t LTR381_ReadRGB_IR(LTR381_HandleTypeDef *hltr, uint32_t *red, uint32_t *green, uint32_t *blue, uint32_t *ir) {
    uint8_t raw_data[12];
    if (hltr->mode != LTR381_MODE_RGB) {
      if (LTR381_Config(hltr, LTR381_MODE_RGB, hltr->gain, hltr->resolution) != 1) return 0;
      delay(10);
    }

    if (LTR381_ReadMultiReg(LTR381_IR_DATA_0, raw_data, 12) != 1) return 0;

    *ir = ((uint32_t)raw_data[2] << 16) | ((uint32_t)raw_data[1] << 8) | raw_data[0];
    *green = ((uint32_t)raw_data[5] << 16) | ((uint32_t)raw_data[4] << 8) | raw_data[3];
    *red = ((uint32_t)raw_data[8] << 16) | ((uint32_t)raw_data[7] << 8) | raw_data[6];
    *blue = ((uint32_t)raw_data[11] << 16) | ((uint32_t)raw_data[10] << 8) | raw_data[9];

    return 1;
}

void LTR381_LED_ON(void) {
    LTR381_WriteReg(0x19, 0x14);
    LTR381_WriteReg(0x21, 0);
    LTR381_WriteReg(0x22, 0);
    LTR381_WriteReg(0x23, 0);
    LTR381_WriteReg(0x24, 0xFF);
    LTR381_WriteReg(0x25, 0xFF);
    LTR381_WriteReg(0x26, 0xFF);
}

void LTR381_LED_OFF(void) {
    LTR381_WriteReg(0x19, 0x00);
}

float LTR381_GetLux_Calibrated(LTR381_HandleTypeDef *hltr, uint32_t raw_als, uint32_t raw_ir) {
    float sensitivity = 3.0f;
    switch (hltr->gain) {
      case LTR381_GAIN_1X: sensitivity = 1.0f; break;
      case LTR381_GAIN_3X: sensitivity = 3.0f; break;
      case LTR381_GAIN_6X: sensitivity = 6.0f; break;
      case LTR381_GAIN_9X: sensitivity = 9.0f; break;
      case LTR381_GAIN_18X: sensitivity = 18.0f; break;
    }

    const float kIR_ALS = 0.8f;
    uint32_t calib_als = (uint32_t)((int32_t)raw_als - (int32_t)(raw_ir * kIR_ALS));
    calib_als = (calib_als > 0) ? calib_als : 0;
    return (float)calib_als * 0.6f / sensitivity;
}

bool US01_Init(void)
{
	Wire.beginTransmission(US01_ADDR);
	uint8_t error = Wire.endTransmission();
	if (error == 0) return true;
    else return false;
}

bool us01_rgb_r(uint8_t r, uint8_t g, uint8_t b)
{
	bool success = true;
	Wire.beginTransmission(US01_ADDR);
	Wire.write(REG_R_RED);
	Wire.write(r);
	if(Wire.endTransmission() != 0) success = false;
	delay(1);

	Wire.beginTransmission(US01_ADDR);
	Wire.write(REG_R_GREEN);
	Wire.write(g);
	if(Wire.endTransmission() != 0) success = false;
	delay(1);

	Wire.beginTransmission(US01_ADDR);
	Wire.write(REG_R_BLUE);
	Wire.write(b);
	if(Wire.endTransmission() != 0) success = false;
	delay(1);

	return success;
}

bool us01_rgb_t(uint8_t r, uint8_t g, uint8_t b)
{
	bool success = true;
	Wire.beginTransmission(US01_ADDR);
	Wire.write(REG_T_RED);
	Wire.write(r);
	if(Wire.endTransmission() != 0) success = false;
	delay(1);

	Wire.beginTransmission(US01_ADDR);
	Wire.write(REG_T_GREEN);
	Wire.write(g);
	if(Wire.endTransmission() != 0) success = false;
	delay(1);

	Wire.beginTransmission(US01_ADDR);
	Wire.write(REG_T_BLUE);
	Wire.write(b);
	if(Wire.endTransmission() != 0) success = false;
	delay(1);

	return success;
}

bool us01_rgb_both(Color_t color)
{
	bool ret1 = us01_rgb_r(color.r, color.g, color.b);
	bool ret2 = us01_rgb_t(color.r, color.g, color.b);
	return (ret1 && ret2);
}

void us01_set_color(uint8_t index)
{
	if(index < COLOR_COUNT) {
		us01_rgb_both(color_table[index]);
	}
}

void rgb_list(uint8_t rgb_change_num) {
  switch (rgb_change_num) {
   case 1: us01_set_color(0); break;
   case 2: us01_set_color(1); break;
   case 3: us01_set_color(2); break;
   case 4: us01_set_color(3); break;
   case 5: us01_set_color(4); break;
   case 6: us01_set_color(5); break;
   case 7: us01_set_color(6); break;
   case 8: us01_set_color(7); break;
  }
}

/*
void loop_Function() {
  Parse_cmd();
  switch (ai_mode) {
   case 1: yanse_shibie(); break;
   case 2: dingju_jiaqu(); break;
   case 3: shengkong_jiaqu(); break;
   case 4: hongwai_chufa(); break;
   case 5: chumo_jiaqu(); break;
  }
}
*/

void PS2_controll() {
  loop_ps2();
  if (millis() - System_RecordTime >= 50 && ps2_cmd != ps2_cmd_last) {
    System_RecordTime = millis();
    if (!(0x1000 & ps2_cmd)) {
      	sprintf(cmd_return, "#%03dP%04dT%04d!", 0, 2400, 1000);
      	parse_action(cmd_return); 
      return;
    } else if (!(0x4000 & ps2_cmd)) {
      	sprintf(cmd_return, "#%03dP%04dT%04d!", 0, 600, 1000);
      	parse_action(cmd_return); 
      return;
    } else if (!(0x8000 & ps2_cmd)) {
      	sprintf(cmd_return, "#%03dP%04dT%04d!", 1, 2400, 1000);
      	parse_action(cmd_return); 
      return;
    } else if (!(0x2000 & ps2_cmd)) {
      	sprintf(cmd_return, "#%03dP%04dT%04d!", 1, 600, 1000);
      	parse_action(cmd_return); 
      return;
    } else if (!(0x0010 & ps2_cmd)) {
      	sprintf(cmd_return, "#%03dP%04dT%04d!", 2, 2400, 1000);
      	parse_action(cmd_return); 
      return;
    } else if (!(0x0040 & ps2_cmd)) {
      	sprintf(cmd_return, "#%03dP%04dT%04d!", 2, 600, 1000);
      	parse_action(cmd_return); 
      return;
    } else if (!(0x0080 & ps2_cmd)) {
      	sprintf(cmd_return, "#%03dP%04dT%04d!", 3, 2400, 1000);
      	parse_action(cmd_return); 
      return;
    } else if (!(0x0020 & ps2_cmd)) {
      	sprintf(cmd_return, "#%03dP%04dT%04d!", 3, 600, 1000);
      	parse_action(cmd_return); 
      return;
    } else if (!(0x0004 & ps2_cmd)) {
      	sprintf(cmd_return, "#%03dP%04dT%04d!", 4, 2400, 1000);
      	parse_action(cmd_return); 
      return;
    } else if (!(0x0008 & ps2_cmd)) {
      	sprintf(cmd_return, "#%03dP%04dT%04d!", 4, 600, 1000);
      	parse_action(cmd_return); 
      return;
    } else if (!(0x0001 & ps2_cmd)) {
      	sprintf(cmd_return, "#%03dP%04dT%04d!", 5, 2400, 1000);
      	parse_action(cmd_return); 
      return;
    } else if (!(0x0002 & ps2_cmd)) {
      	sprintf(cmd_return, "#%03dP%04dT%04d!", 5, 600, 1000);
      	parse_action(cmd_return); 
      return;
    } else if (!(0x0100 & ps2_cmd)) {
      	sprintf(cmd_return, "#%03dP%04dT%04d!", 255, 1500, 1000);
      	parse_action(cmd_return); 
      return;
    }
    if ((~ps2_cmd_last) & ps2_cmd & 0x1000) {
      sprintf(cmd_return, "#%03dPDST!", 0);
      	parse_action(cmd_return); 
      return;
    } else if ((~ps2_cmd_last) & ps2_cmd & 0x4000) {
      sprintf(cmd_return, "#%03dPDST!", 0);
      	parse_action(cmd_return); 
      return;
    } else if ((~ps2_cmd_last) & ps2_cmd & 0x8000) {
      sprintf(cmd_return, "#%03dPDST!", 1);
      	parse_action(cmd_return); 
      return;
    } else if ((~ps2_cmd_last) & ps2_cmd & 0x2000) {
      sprintf(cmd_return, "#%03dPDST!", 1);
      	parse_action(cmd_return); 
      return;
    } else if ((~ps2_cmd_last) & ps2_cmd & 0x0010) {
      sprintf(cmd_return, "#%03dPDST!", 2);
      	parse_action(cmd_return); 
      return;
    } else if ((~ps2_cmd_last) & ps2_cmd & 0x0040) {
      sprintf(cmd_return, "#%03dPDST!", 2);
      	parse_action(cmd_return); 
      return;
    } else if ((~ps2_cmd_last) & ps2_cmd & 0x0080) {
      sprintf(cmd_return, "#%03dPDST!", 3);
      	parse_action(cmd_return); 
      return;
    } else if ((~ps2_cmd_last) & ps2_cmd & 0x0020) {
      sprintf(cmd_return, "#%03dPDST!", 3);
      	parse_action(cmd_return); 
      return;
    } else if ((~ps2_cmd_last) & ps2_cmd & 0x0004) {
      sprintf(cmd_return, "#%03dPDST!", 4);
      	parse_action(cmd_return); 
      return;
    } else if ((~ps2_cmd_last) & ps2_cmd & 0x0008) {
      sprintf(cmd_return, "#%03dPDST!", 4);
      	parse_action(cmd_return); 
      return;
    } else if ((~ps2_cmd_last) & ps2_cmd & 0x0001) {
      sprintf(cmd_return, "#%03dPDST!", 5);
      	parse_action(cmd_return); 
      return;
    } else if ((~ps2_cmd_last) & ps2_cmd & 0x0002) {
      sprintf(cmd_return, "#%03dPDST!", 5);
      	parse_action(cmd_return); 
      return;
    }

  }
  ps2_cmd_last = ps2_cmd;
}

void Battery_check() {
  int input_vol = 0;
  int adcValue = 0;
  int battery_percent = 0;
  if (millis() - Systick_ms_battery >= 1000) {
    Systick_ms_battery = millis();
    adcValue = analogRead(adcPin);
    input_vol = (long) (((adcValue * 4) * 3.3)) % (long) (4095);
  }
  if (input_vol >= 8.4) {
    battery_percent = 100;
  } else if (input_vol >= 8.2) {
    battery_percent = (input_vol - 8.2) * 50 + 90;
  } else if (input_vol >= 7.8) {
    battery_percent = (input_vol - 7.8) * 100 + 50;
  } else if (input_vol >= 7.2) {
    battery_percent = (input_vol - 7.2) * 66.7 + 10;
  } else if (input_vol >= 6.0) {
    battery_percent = (input_vol - 6.0) * 8.3;
  } else {
    battery_percent = 0;

  }
}

void Parse_cmd() {
  if (String(uart_receive_str_bak).length()) {
    if (String(uart_receive_str_bak).equals(String("$RGBD!"))) {
      for(int i=0;i<1;i++) { beep_on(); delay(100); beep_off(); delay(100); }
      if (color_num == 9) color_num = 1;
      rgb_list(color_num);
      color_num = color_num + 1;
    } else if (String(uart_receive_str_bak).equals(String("$YSSB!"))) {
      for(int i=0;i<1;i++) { beep_on(); delay(100); beep_off(); delay(100); }
      ai_mode = 1;
    } else if (String(uart_receive_str_bak).equals(String("$DJJQ!"))) {
      for(int i=0;i<1;i++) { beep_on(); delay(100); beep_off(); delay(100); }
      ai_mode = 2;
    } else if (String(uart_receive_str_bak).equals(String("$SKJQ!"))) {
      for(int i=0;i<1;i++) { beep_on(); delay(100); beep_off(); delay(100); }
      ai_mode = 3;
    } else if (String(uart_receive_str_bak).equals(String("$RGBD!"))) {
      for(int i=0;i<1;i++) { beep_on(); delay(100); beep_off(); delay(100); }
      ai_mode = 4;
    } else if (String(uart_receive_str_bak).equals(String("$HWCF!"))) {
      for(int i=0;i<1;i++) { beep_on(); delay(100); beep_off(); delay(100); }
      ai_mode = 5;
    } else if (String(uart_receive_str_bak).equals(String("$CMJQ!"))) {
      for(int i=0;i<1;i++) { beep_on(); delay(100); beep_off(); delay(100); }
      ai_mode = 6;
    } else if (String(uart_receive_str_bak).equals(String("$DJMS!"))) {
      for(int i=0;i<1;i++) { beep_on(); delay(100); beep_off(); delay(100); }
      ai_mode = 255;
    }
    uart_receive_str_bak = "";
  }
}

uint32_t ltr381_red_value = 0;
uint32_t ltr381_green_value = 0;
uint32_t ltr381_blue_value = 0;
uint32_t ltr381_ir_value = 0;
void yanse_shibie() {
  int red = 0, blue = 0, green = 0, ir_lux = 0;
  if (group_do_ok==1) {
    if (millis() - Systick_ms_yanse >= 50) {
      Systick_ms_yanse = millis();
      ir_lux = (LTR381_ReadRGB_IR(&ltr381, &ltr381_red_value, &ltr381_green_value, &ltr381_blue_value,&ltr381_ir_value) != 0) ? ltr381_ir_value : 0;
      delay(100);
      if (ir_lux <= 60 && ir_lux >= 10) {
        red = (LTR381_ReadRGB(&ltr381, &ltr381_red_value, &ltr381_green_value, &ltr381_blue_value) != 0) ? ltr381_red_value : 0;
        blue = (LTR381_ReadRGB(&ltr381, &ltr381_red_value, &ltr381_green_value, &ltr381_blue_value) != 0) ? ltr381_blue_value : 0;
        green = (LTR381_ReadRGB(&ltr381, &ltr381_red_value, &ltr381_green_value, &ltr381_blue_value) != 0) ? ltr381_green_value : 0;
        max_color = max(max(green, blue), red);
        if (max_color == red) {
          rgb_list(1);
          parse_cmd("$DGT:1-9,1!");
        } else if (max_color == green && (max(green, blue) == green && (green >= 1000 && blue <= 1000))) {
          rgb_list(2);
          parse_cmd("$DGT:10-19,1!"); 
        } else if (max_color == blue) {
          rgb_list(3);
          parse_cmd("$DGT:20-29,1!"); 
        }
      }
    }
  }
}

bool us01_start_measuring(void)
{
    Wire.beginTransmission(US01_ADDR);
    Wire.write(0x10);      
    Wire.write(0x01);      
    uint8_t error = Wire.endTransmission();
    if(error != 0) return false;
    return true;
}

float us01_read_distance(void)
{
    uint8_t value_H = 0, value_L = 0;
    uint16_t raw_data = 0;
    float distance = 0;

    Wire.requestFrom(US01_ADDR, 2);
    if(Wire.available() >= 2) {
        value_H = Wire.read();
        value_L = Wire.read();
        raw_data = (value_H << 8) | value_L;
        distance = raw_data * 0.017f;
        return distance;
    } else {
        return -1;
    }
}
void dingju_jiaqu() {
  int distance = 0;
  int dis_reg = 15;
  if (group_do_ok==1 && millis() - Systick_ms_dingju >= 100) {
    Systick_ms_dingju = millis();
    us01_start_measuring();
    delay(100);
    distance = us01_read_distance();
    if (distance <= dis_reg + 1 && distance >= dis_reg - 1) {
      for(int i=0;i<1;i++) { beep_on(); delay(100); beep_off(); delay(100); }	
      parse_cmd("$DGT:30-38,1!"); 
    }
  }
}

void shengkong_jiaqu() {
  if (group_do_ok==1) {
    if (digitalRead(19) == LOW) {
      for(int i=0;i<1;i++) { beep_on(); delay(100); beep_off(); delay(100); }	
      parse_cmd("$DGT:10-19,1!"); 
    }
  }
}

void hongwai_chufa() {
  if (group_do_ok==1) {
    if (digitalRead(13) == LOW) {
      for(int i=0;i<1;i++) { beep_on(); delay(100); beep_off(); delay(100); }	
      parse_cmd("$DGT:10-19,1!"); 
    }
  }
}

void chumo_jiaqu() {
  if (group_do_ok==1) {
    if (digitalRead(8) == LOW) {
      for(int i=0;i<1;i++) { beep_on(); delay(100); beep_off(); delay(100); }	
      parse_cmd("$DGT:10-19,1!"); 
    }
  }
}

void setup(){
  Systick_ms_battery = 0;
  Systick_ms_dingju = 0;
  Systick_ms_yanse = 0;
  System_RecordTime = 0;
  max_color = 0;
  ai_mode = 0;
  color_num = 0;
setup_kinematics(100, 105, 75, 180, &kinematics);
  Wire.begin(PIN_SDA, PIN_SCL);
  Serial.begin(115200);

  //0316
  setup_emergency_stop();

  setup_w25q();
	setup_nled();
	setup_uart();
	setup_beep();
	setup_start();

  Wire.begin(PIN_SDA, PIN_SCL);
	Wire.setClock(100000); 
	US01_Init();
	Serial.println("US01初始化成功!");
  LTR381_Init();
LTR381_Config(&ltr381, LTR381_MODE_RGB, LTR381_GAIN_3X, LTR381_RESOLUTION_100MS);
Serial.println("LTR381初始化完成");
  setup_servo();    
  delay(1000);
  LTR381_LED_ON();
  for(int i=0;i<3;i++) {
  		beep_on();
  		delay(100);
  		beep_off();
  		delay(100);
  }
//0316  pinMode(19, INPUT_PULLUP);
  pinMode(13, INPUT_PULLUP);
  pinMode(8, INPUT_PULLUP);
}

void loop(){
    //0316
    loop_emergency_stop();
    loop_nled();
    loop_uart();    
    loop_action();  
    loop_servo();   
//0316    loop_Function();
    PS2_controll();
    loop_torque_control();
    loop_print_tcp();  
    loop_fixed_move();  
    loop_teach_record();          
}
