int iterPower(int base, int exp){
    int result = 1;
    while(exp>=1){
	result += base;
	exp -= 1;
    }
    return result;
}