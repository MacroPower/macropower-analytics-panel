package payloadtest

import (
	"bytes"
	"encoding/json"
	"errors"
	"io/ioutil"
	"net/http"
	"path"
	"runtime"
	"sync"
	"testing"

	"github.com/MacroPower/macropower-analytics-panel/server/payload"
)

func getCallerDir() (string, error) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		return "", errors.New("Could not get the caller for payloadtest")
	}
	return path.Dir(filename), nil
}

// SafeBuffer is a concurrency-safe bytes.Buffer
type SafeBuffer struct {
	buffer bytes.Buffer
	mutex  sync.Mutex
}

// Write calls buffer.Write(p)
func (s *SafeBuffer) Write(p []byte) (n int, err error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	return s.buffer.Write(p)
}

// Reset calls buffer.Reset()
func (s *SafeBuffer) Reset() {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	s.buffer.Reset()
}

// String calls buffer.String()
func (s *SafeBuffer) String() string {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	return s.buffer.String()
}

// GetPayload returns an example Payload to be used for testing
func GetPayload(t *testing.T) (p payload.Payload) {
	callerDir, err := getCallerDir()
	if err != nil {
		t.Fatal(err)
	}

	file, err := ioutil.ReadFile(callerDir + "/testdata/payload.json")
	if err != nil {
		t.Fatal(err)
	}

	err = json.Unmarshal([]byte(file), &p)
	if err != nil {
		t.Fatal(err)
	}

	return p
}

// SendPayload sends a payload to the provided test server
func SendPayload(t *testing.T, url string, p payload.Payload) {
	requestByte, _ := json.Marshal(p)
	requestReader := bytes.NewReader(requestByte)

	resp, err := http.Post(url, "application/json", requestReader)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 201 {
		t.Fatalf("Received non-201 response: %d\n", resp.StatusCode)
	}

	expected := ""
	actual, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	if expected != string(actual) {
		t.Errorf("Expected the message '%s'\n", expected)
	}
}
