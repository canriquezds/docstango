import React, { useState } from 'react';

import OpenAI from "openai";

const InputLogger: React.FC = () => {
  const [inputText, setInputText] = useState('');

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(event.target.value);
  };

  const handleButtonClick = async () => {
    const client = new OpenAI(
      {apiKey: process.env.REACT_APP_OPEN_API_KEY, dangerouslyAllowBrowser: true}
    );

    const response = await client.responses.create({
        model: "gpt-4.1",
        input: inputText,
    });

    console.log(response.output_text);
    // console.log("Here is the value", process.env.REACT_APP_OPEN_API_KEY);
  };

  return (
    <div className="input-logger">
      <textarea
        value={inputText}
        onChange={handleInputChange}
        placeholder="Enter text here"
        rows={4}
        cols={30}
      />
      <div style={{ marginTop: '10px' }}>
        <button onClick={handleButtonClick}>Log to Console</button>
      </div>
    </div>
  );
};

export default InputLogger;